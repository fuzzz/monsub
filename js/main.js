
Ext.Loader.setConfig({enabled: true});
Ext.Loader.setPath('Ext.ux', 'lib/ux');
Ext.require([
    'Ext.grid.*',
    'Ext.data.*',
    'Ext.panel.*',
    'Ext.layout.*',
    'Ext.container.*',
    'Ext.*',
]);
var gui = require('nw.gui');
var win = gui.Window.get();
win_title="Monitor Subscriber Parser";


Ext.onReady(function(){
    Ext.define('Sandbox.view.gridFilterString', {
        extend: 'Ext.form.field.Text',
        alias: 'widget.gridFilterString',
        margin:0,
        emptyText: 'Filter...',
        setFilter: function(filterId, value){
            var store = this.up('grid').getStore();
            if(value){
                store.removeFilter(filterId, false)
                var filter = {id: filterId, property: filterId, value: value};
                if(this.anyMatch) filter.anyMatch = this.anyMatch
                if(this.caseSensitive) filter.caseSensitive = this.caseSensitive
                if(this.exactMatch) filter.exactMatch = this.exactMatch
                if(this.operator) filter.operator = this.operator
                store.addFilter(filter)
            } else {
                store.filters.removeAtKey(filterId)
            }
        },
        listeners: {
            render: function(){
                var me = this;
                me.ownerCt.on('resize', function(){
                    me.setWidth(this.getEl().getWidth())
                })
            },
            change: function() {
                if(this.autoSearch) this.setFilter(this.up().dataIndex, this.getValue())
            }
        }
    });
    Ext.define('my.mainModel', {
        extend : 'Ext.data.Model',
        config : {
            fields : [
                { name : 'recordType', type : 'string'},
                { name : 'time', type : 'string'},
                { name : 'eventId', type : 'string'},
                { name : 'pduType', type : 'string'},
                { name : 'from', type : 'string'},
                { name : 'to', type : 'string'},
                { name : 'description', type : 'string'},
                { name : 'fullText', type : 'string'}
            ]
        }
    });
    var data={
        list:[]
    };
    var store = Ext.create('Ext.data.Store', {
        autoLoad: true,
        model: 'my.mainModel',
        storeId: 'mainStore',
        data : data,
        proxy: {
            type: 'memory',
            reader: {
                type: 'json',
                rootProperty: 'list'
            }
        }
    });
    var myPager={
        init:function(source){
            if (!source) {
                source="file";
            }
            this.source=source
            this.page=0;
            this.filename='';
            this.total=0;
        },
        render:function(){
            if (this.total>1) {
                Ext.getCmp('myPagerLabel').setText('File parts '+(this.page+1)+'/'+this.total);
                Ext.getCmp('myPagerLabel').show();
                Ext.getCmp('myPagerPrev').show();
                Ext.getCmp('myPagerNext').show();
            }else{
                Ext.getCmp('myPagerLabel').hide();
                Ext.getCmp('myPagerPrev').hide();
                Ext.getCmp('myPagerNext').hide();
            }
        },
        pageSize:50000
    };
    myPager.init();
    var viewport = Ext.create('Ext.container.Viewport', {
        layout: 'border',
        items: [{
            region: 'north',
            dockedItems: [{
                xtype: 'toolbar',
                dock: 'top',
                items: [{
                    xtype:'filebutton',
                    listeners:{
                        change:function(s,e){
                            if (!e.event.target.files.length) {
                                return;
                            }
                            file=e.event.target.files[0];
                            myPager.init();
                            myPager.filename=file.path;
                            readFileLineByLine(myPager);
                        }
                    },
                    text:'Parse file',
                    iconCls:'icon-folder'
                },{
                    xtype:'button',
                    listeners:{
                        click:function(){
                            myPager.init('clipboard');
                            readClipboard(myPager);
                        }
                    },
                    text:'Parse clipboard',
                    iconCls:'icon-clipboard'
                /*},{
                    xtype:'button',
                    text:'Tools',
                    iconCls:'icon-advancedsettings',
                    menu:[{
                        listeners:{
                            click:function(){
                                calculateThroughput();
                            }
                        },
                        text:'Calculate Throughput',
                        iconCls:'icon-clipboard'
                    }]*/
                },{
                    xtype:'button',
                    iconCls:'icon-left',
                    id:'myPagerPrev',
                    hidden:true,
                    listeners:{
                        click:function(){
                            myPager.page--;
                            if (myPager.page<0) {
                                myPager.page=0;
                            }else{
                                readFileLineByLine(myPager);
                            }
                        }
                    }
                },{
                    xtype:'label',
                    hidden:true,
                    id:'myPagerLabel'
                },{
                    xtype:'button',
                    iconCls:'icon-right',
                    id:'myPagerNext',
                    hidden:true,
                    listeners:{
                        click:function(){
                            myPager.page++;
                            if (myPager.page>=myPager.total) {
                                myPager.page=myPager.total-1;
                            }else{
                                readFileLineByLine(myPager);
                            }
                        }
                    }
                },'->',{
                    xtype:'label',
                    id:'searchLabel'
                },{
                    xtype:'textfield',
                    id:'searchInput',
                    cls: 'round-corners',
                    disabled:true,
                    width: 300,
                    enableKeyEvents:true,
                    triggers:{
                        clear: {
                            weight: 0,
                            cls: Ext.baseCSSPrefix + 'form-clear-trigger',
                            hidden: true,
                            handler: 'onClearClick'
                        },
                        search: {
                            weight: 1,
                            cls: Ext.baseCSSPrefix + 'form-search-trigger',
                            handler: 'onSearchClick'
                        },
                        next:{
                            cls:'icon-down',
                            hidden: true,
                            handler: 'onNextClick',
                        },
                        prev:{
                            cls:'icon-up',
                            hidden: true,
                            handler: 'onPrevClick',
                        }
                    },
                    listeners:{
                        change: 'onChange',
                        keypress: 'onKeyPress',
                    },
                    searchResultsLength:0,
                    highlightedResult:0,
                    highlightSearch: function(query) {
                        var r = new RegExp("(" + query + ")", "gim");
                        this.clearHighlight();
                        var e = Ext.getCmp('outputPanel').body.select("div[data-ref=innerCt] pre").elements[0].innerHTML;
                        var newe = e.replace(r, "<span>$1</span>");
                        Ext.getCmp('outputPanel').update('<pre>'+newe+'</pre>');
                    },
                    clearHighlight: function(){
                        Ext.Array.forEach(Ext.getCmp('outputPanel').body.select("div[data-ref=innerCt] pre span").elements, function(el, n, a){
                            el.outerHTML=el.innerHTML;
                        });
                    },
                    updateLabel: function(t){
                        Ext.getCmp('searchLabel').setText(t);
                    },
                    onChange: function(){
                        triggers=this.getTriggers();
                        this.highlightedResult=0;
                        //this.currentSearchItem=0;
                        if (this.value) {
                            triggers.clear.show();
                            triggers.next.show();
                            triggers.prev.show();
                            this.highlightSearch(this.value);
                            this.searchResultsLength=Ext.getCmp('outputPanel').body.select("div[data-ref=innerCt] span").elements.length
                            if (this.searchResultsLength) {
                                this.updateLabel('Founded items: '+this.searchResultsLength+'. Highlighted 1 of '+this.searchResultsLength);
                                this.onNextClick();
                            }else{
                                this.updateLabel('Nothing in current packet. Press Enter to search within each packet.');
                                this.highlightedResult=0;
                            }
                        }else{
                            triggers.clear.hide();
                            triggers.next.hide();
                            triggers.prev.hide();
                            this.clearHighlight();
                            this.updateLabel('');
                            this.searchResultsLength=0;
                            this.highlightedResult=0;
                        }
                    },
                    onClearClick: function(){
                        this.setValue('');
                    },
                    onNextClick: function(){
                        this.highlightedResult++;
                        if (this.highlightedResult>this.searchResultsLength) {
                            this.highlightedResult=1;
                        }
                        Ext.Array.forEach(Ext.getCmp('outputPanel').body.select("div[data-ref=innerCt] span.highlight").elements, function(el, n, a){
                            el.classList.remove('highlight');
                        });
                        Ext.getCmp('outputPanel').body.select("div[data-ref=innerCt] span").elements[this.highlightedResult-1].classList.add('highlight');
                        this.scrollToHighlight();
                    },
                    onPrevClick: function(){
                        this.highlightedResult--;
                        if (this.highlightedResult<1) {
                            this.highlightedResult=this.searchResultsLength;
                        }
                        Ext.Array.forEach(Ext.getCmp('outputPanel').body.select("div[data-ref=innerCt] span.highlight").elements, function(el, n, a){
                            el.classList.remove('highlight');
                        });
                        Ext.getCmp('outputPanel').body.select("div[data-ref=innerCt] span").elements[this.highlightedResult-1].classList.add('highlight');
                        this.scrollToHighlight();
                    },
                    scrollToHighlight:function(){
                        if (!Ext.getCmp('outputPanel').body.select("div[data-ref=innerCt] span.highlight").elements.length) {
                            return;
                        }
                        el=Ext.getCmp('outputPanel').body.select("div[data-ref=innerCt] span.highlight").elements[0];
                        h=Ext.getCmp('outputPanel').getHeight();
                        w=Ext.getCmp('outputPanel').getWidth();
                        y=el.offsetTop-h/2;
                        x=el.offsetLeft-w/2;
                        //console.log('h:'+h+', w:'+w+', top:'+el.offsetTop+', left:'+el.offsetLeft);
                        Ext.getCmp('outputPanel').scrollTo(x,y,true)
                    },
                    
                    currentSearchItem:0,
                    onSearchClick:function(){
                        plen=Ext.getCmp('packetList').getStore().getData().items.length;
                        if (Ext.getCmp('packetList').getSelectionModel().selected.items.length) {
                            this.currentSearchItem=Ext.getCmp('packetList').getSelectionModel().selected.items[0].internalId;
                            if (this.currentSearchItem>=plen) {
                                this.currentSearchItem=0;
                            }
                        }else{
                            this.currentSearchItem=0;
                        }
                        for(var i=0;i<plen;i++){
                            ri=this.currentSearchItem+i;
                            if (ri>=plen) {ri-=plen;}
                            if(Ext.getCmp('packetList').getStore().getData().items[ri].data.fullText.search(this.value)>-1){
                                Ext.getCmp('packetList').getSelectionModel().select(ri);
                                this.onChange();
                                this.currentSearchItem=ri+1;
                                if (this.currentSearchItem>=plen) {
                                    this.currentSearchItem=0;
                                }
                                Ext.getCmp('searchInput').focus();
                                return;
                            }
                        }
                        Ext.Msg.show({
                            title:'Search',
                            message: '"'+this.value+'" not founded.',
                            buttons: Ext.Msg.OK,
                            icon: Ext.Msg.INFO
                        });
                    },
                    onKeyPress:function(s, e, o){
                        if(s.parentEvent.charCode === 13){
                            this.onSearchClick();
                        }
                    }
                }]
            }],
            border: false
        }, {
            region: 'center',
            id: 'packetList',
            xtype: 'grid',
            store: Ext.data.StoreManager.lookup('mainStore'),
            loadMask: true,
            columns: {
                items:[{
                        text : 'recordType',
                        dataIndex : 'recordType',
                        renderer: function(v){return Ext.String.htmlEncode(v);}
                    },
                    { text : 'time', dataIndex : 'time'},
                    { text : 'eventId', dataIndex : 'eventId'},
                    { text : 'pduType', dataIndex : 'pduType'},
                    { text : 'from', dataIndex : 'from'},
                    { text : 'to', dataIndex : 'to'},
                    { text : 'description', dataIndex : 'description', flex: 1}/*,
                    { text : 'fullText', dataIndex : 'fullText'}*/
                ],
                defaults:{
                    sortable: true,
                    renderer: function(v){return Ext.String.htmlEncode(v);},
                    items:[{
                        xtype: 'gridFilterString',
                        anyMatch: true,
                        autoSearch: true
                    }]
                }
            },
            listeners:{
                select:function(s,r,i,e){
                    Ext.getCmp('outputPanel').update('<pre>'+Ext.String.htmlEncode(r.data.fullText)+'</pre>');
                    Ext.getCmp('searchInput').enable();
                    Ext.getCmp('searchInput').onChange();
                }
            }
        },{
            region: 'south',
            id: 'outputPanel',
            html:'<div style="text-align:center"><h3>Open file and select any packet</h3></div>',
            height: '60%',
            border: 2,
            resizable:true,
            scroll: 'both',
            //reserveScrollbar: true
        }]
    });
    searchKeyMap=new Ext.util.KeyMap({
        target: document,
        binding: [{
            key: "f",
            ctrl:true,
            fn: function(){Ext.getCmp('searchInput').focus(true);}
        }]
    });
    function readFileLineByLine(myPager) {
        console.log('Open file '+myPager.filename);
        var LineByLineReader = require('line-by-line');
        var lr = new LineByLineReader(myPager.filename);
        Parser.init(myPager);
        lr.on('error', function (err) {
            Parser.breakWork();
            Ext.Msg.show({
                title:'Error!',
                message: 'See console',
                buttons: Ext.Msg.OK,
                icon: Ext.Msg.WARNING
            });
            console.log(err);
        });
        lr.on('line', function (line) {
            Parser.doLine(line+"\r\n");
        });
        lr.on('end', function () {
            console.log('file END! Total packet in file - '+Parser.packetCounter);
            win.title=win_title+' - '+file.path;
            Parser.endWork();
        });
    }
    function readClipboard(myPager) {
        console.log('Start reading from clipboard');
        Parser.init(myPager);
        var clipboard = gui.Clipboard.get();
        var text = clipboard.get('text');
        var tmpArray = text.split(/\n/);
        Parser.clipboardLineLength=tmpArray.length;
        for(var id in tmpArray){
            Parser.doLine(tmpArray[id]);
        }
        console.log('Clipboard END! Total packet parsed - '+Parser.packetCounter);
        win.title=win_title+' - Clipboard';
        Parser.endWork();
    }
/*
    function calculateThroughput() {

        var lastts;
        var current_window=1;
        var current_ts;
        var current_data = new Array();
        var steps = 50;
        var i=0;
        var data=store.getData();
        var total=data.length;
        var gdiag = {
            steps:50,
            first:time2ts(data.items[0].data.time),
            last:time2ts(data.items[total-1].data.time),
            duration:last-first,
            getWindow:function(ts){
            
            }
        }
        if (gdiag.duration<0) {
            gdiag.duration += 86400000;
        }
        gdiag.tstep=gdiag.duration/gdiag.steps;
        var gdata = new Array();
        for(var i = 1;i<=steps;i++){
            gdata[first+i*tstep]={data1: 0 , data2: 0 };
        }
        pb=Ext.Msg.progress('Parsing','Please wait...');
        store.each(function(record){
            m=/GTPU (Tx|Rx)\sPDU, from .+ to .+\s\((.+)\)/m.exec(record.data.fullText)
            if (m) {
                current_ts=time2ts(record.data);
                current_data[m[1]]+=Number(m[2]);
                lastts=current_ts;
            }
            i++;
            if (!(i%1000)) {
                var pText=Math.round(i/total*100)+'%';
                pb.updateProgress(i/total,pText);
            }
            if (i == total) {
                pb.close();
            }
        });
    }*/
});
function packetItem(){
    this.description=new StringBuilder();
}
function StringBuilder () {
  var values = [];
  return {
    a2d: function (value) {
        if (values.length) {
            values.push(", ");
        }
        values.push(value);
    },
    toString: function () {
      return values.join('');
    }
  };
}

Parser = {
    init:function(myPager){
        this.myPager=myPager;
        this.lineCounter=0;
        this.byteCounter=0;
        this.stringCounter=0;
        this.packetCounter=0;
        this.pb=Ext.Msg.progress('Parsing','Please wait...');
        this.clearTmpData();
        this.startPacket=this.myPager.page*this.myPager.pageSize;
        this.endPacket=this.startPacket+this.myPager.pageSize;
        this.store=Ext.data.StoreManager.lookup('mainStore');
        this.flag1=false;
        this.store.removeAll();
    },
    storePacket:function(){
        if ((this.packetCounter>=this.startPacket) && (this.packetCounter<this.endPacket)) {
            this.tmpData.description=this.tmpData.description.toString();
            this.store.add(this.tmpData);
            this.doAnaliz=true;
        }else{
            this.doAnaliz=false;
        }
        this.clearTmpData();
        this.packetCounter++;
    },
    clearTmpData:function() {
        this.tmpData=new packetItem();
    },
    doLine:function(line){
        this.doAnaliz=true;
        this.lineCounter++;
        this.byteCounter+=line.length;
        if (!(this.lineCounter%1000)) {
            if (this.myPager.source==='file') {
                var pText=Math.round(this.byteCounter/file.size*100)+'%';
                this.pb.updateProgress(this.byteCounter/file.size,pText);
            }
            if (this.myPager.source==='clipboard') {
                var pText=Math.round(this.lineCounter/this.clipboardLineLength*100)+'%';
                this.pb.updateProgress(this.lineCounter/this.clipboardLineLength,pText);
            }
        }
        m=/^(.+)\s+(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,3})\s+Eventid:(.+)/.exec(line);
        if (m) {
            if (this.tmpData.recordType) {
                this.storePacket(this.tmpData);
            }
            this.tmpData.recordType="???";
            if(m[1] == 'INBOUND>>>>> '){this.tmpData.recordType=">IN>";}
            if(m[1] == '<<<<OUTBOUND '){this.tmpData.recordType="<OUT<";}
            if(m[1] == '***CONTROL***'){this.tmpData.recordType="*CTRL*";}
            this.tmpData.time=m[2]+":"+m[3]+":"+m[4]+":"+m[5];
            this.tmpData.eventId=m[6];
            this.tmpData.fullText=line;
            this.stringCounter=0;
            return;
        }
        m=/^\(Switching|Adding Trace\) - New Incoming Call:/.exec(line);
        if (m) {
            if (this.tmpData.recordType) {
                this.storePacket(this.tmpData);
            }
            this.tmpData.recordType="*CTRL*";
            this.tmpData.time=0;
            this.tmpData.eventId="********";
            this.flag1=false;
            
            this.tmpData.fullText=line;
            this.stringCounter=0;
            this.tmpData.pduType="***NEW CALL***";this.tmpData.from="********";this.tmpData.to="********";
            return;
        }
        m=/Call Finished - Waiting to trace next matching call/.exec(line);
        if (m) {
            if (this.tmpData.recordType) {
                this.storePacket(this.tmpData);
            }
            this.tmpData.recordType="*CTRL*";
            this.tmpData.time=0;
            this.tmpData.eventId="********";
            this.flag1=false;
            
            this.tmpData.fullText=line;
            this.stringCounter=0;
            this.tmpData.pduType="***CALL END***";this.tmpData.from="********";this.tmpData.to="********";
            this.tmpData.description.a2d("Call Finished - Waiting to trace next matching call");
            return;
        }
        this.stringCounter++;
        this.tmpData.fullText+=line;
        
        
        if (!this.doAnaliz) {
            return;
        }
        //Protocol specific parse rules
        if(this.stringCounter == 1){
            m=/^(.+)\sPDU, from (.+) to (.+)\s(.+)/.exec(line)
            if(m){
                this.tmpData.pduType=m[1];
                this.tmpData.from=m[2];
                this.tmpData.to=m[3];
            }
            m=/^(.+)\sPDU\s\(\d+\)/.exec(line)
            if(m){
                this.tmpData.pduType=m[1];
            }
            m=/^([^,]+)\sfrom (.+) to (.+)\s*.*/.exec(line)
            if(m){
                this.tmpData.pduType=m[1];
                this.tmpData.from=m[2];
                this.tmpData.to=m[3];
            }
            m=/^CALL STATS.+(Call-Duration\(sec\)\: \d+)/.exec(line)
            if(m){
                this.tmpData.pduType="***CALL STATS***";
                this.tmpData.description=m[1];
            }
        }
        m=/^Protocol Discriminator :\s(.+)/.exec(line)
        if(m){
            if(!this.tmpData.pduType){this.tmpData.pduType=m[1];}
        }
        m=/^===> GSM Mobile Application \(MAP\)/.exec(line)
        if(m){
            this.tmpData.pduType="MAP";
        }
        m=/GTPC/.exec(this.tmpData.pduType)
        if(m){
            m=/Message type:\s(.+)\s\(.+\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
            m=/Cause:\s.+\s\((.+)\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
        }
        m=/GTPP/.exec(this.tmpData.pduType)
        if(m){
            m=/Message Type:\s(.+)\s\(.+\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
            m=/Cause:\s.+\s\((.+)\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
        }
        m=/GTPv2C/.exec(this.tmpData.pduType)
        if(m){
            m=/Message type:\s(.+)\s\(.+\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
            m=/Cause:\s(.+)\s\(.+\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
        }
        m=/GTPU/.exec(this.tmpData.pduType)
        if(m){
            m=/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,5} > \d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,5}:\s+.*\s+\[.+\])/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
        }
        m=/NEW CALL/.exec(this.tmpData.pduType)
        if(m){
            m=/MSID\/IMSI\s+:\s+(\d+)\s+/.exec(line);
            if(m){
                this.tmpData.description.a2d("IMSI:"+m[1]);
            }
            m=/SessionType\s+:\s+(.+)/.exec(line)
            if(m){
                this.tmpData.description.a2d("SessionType:"+m[1]);
            }
        }
        m=/CDR/.exec(this.tmpData.pduType)
        if(m){
            m=/Message Type:\s(.+)\s\(.+\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
        }
        m=/S1AP/.exec(this.tmpData.pduType)
        if(m){
            m=/Procedure Code\s+:\s(.+)\s+\(.+\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
            m=/Choice index\s+:\s(.+)\s+\(.+\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
        }
        m=/Diameter/.exec(this.tmpData.pduType)
        if(m){
            m=/Command Code:\s+0x[0-9a-f]+\s+\(.+\)\s+(.+)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
            m=/Code:      0x0000010c \(268\) Result-Code/.exec(line)
            if(m){
                this.flag1=true;
            }
            if (this.flag1) {
                m=/Data:\s+(.+)\s+\(\d+\)/.exec(line);
                if(m){
                    this.tmpData.description.a2d(m[1]);
                    this.flag1=false;
                }
            }
        }
        m=/NAS/.exec(this.tmpData.pduType)
        if(m){
            if(this.flag1){
                m=/^\s+(.+)\(.+\)/.exec(line)
                if(m){
                    this.tmpData.description.a2d(m[1]);
                    this.flag1=false;
                }
            }
            m=/Message Type/.exec(line)
            if(m){
                this.flag1=true;
            }
            m=/Reject Cause/.exec(line)
            if(m){
                this.flag1=true;
            }
            m=/Protocol Discriminator/.exec(line)
            if(m){
                //$flag1=true;
            }
        }
        m=/SGS/.exec(this.tmpData.pduType)
        if(m){
            if(this.flag1){
                m=/^\s+(.+)\(.+\)/.exec(line)
                if(m){
                    this.tmpData.description.a2d(m[1]);
                    this.flag1=false;
                }
            }
            m=/SGs-AP\s\(\d+\s\w+\)/.exec(line)
            if(m){
                this.flag1=true;
            }
        }
        if(/GMM message/.test(this.tmpData.pduType) || /SM message/.test(this.tmpData.pduType)){
            m=/^Message\s+:\s(.+)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
            m=/Cause\s+:\s+\(.+\)\s+(.+)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
        }
        m=/MAP/.exec(this.tmpData.pduType)
        if(m){
            m=/^\s+MAP\s(.+)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
            m=/Component\s+:\s+(.+)\(.+\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
        }
        m=/\*CTRL\*/.exec(this.tmpData.recordType)
        if(m){
            m=/imsi (\d+),\s.+/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[0]);
            }
            m=/(imsi <\d+>, apn <.+>)./.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
            m=/(Dropped pdu.+)./.exec(line)
            if(m){
                this.tmpData.description.a2d(m[0]);
                this.tmpData.pduType="Dropped pdu";
            }
            m=/(deleted)./.exec(line)
            if(m){
                this.tmpData.description.a2d(line);
            }
        }
        m=/PPP/.exec(this.tmpData.pduType)
        if(m){
            m=/[A-Z]+\s+\d+:\s+(.+\(\d+\).*)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[0]);
            }
            m=/^IP\s\d+:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\.{0,1}\d{0,5})\s>\s(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\.{0,1}\d{0,5}):\s+(.+)/.exec(line);
            if(m){
                m_=/^\s*(\[[^\]]+\])/.exec(m[3]);
                if (m_) {
                    this.tmpData.description.a2d(m_[1]);
                }
                m_=/^\s*(icmp)/.exec(m[3]);
                if (m_) {
                    this.tmpData.description.a2d(m_[1]);
                }
                this.tmpData.from=m[1];
                this.tmpData.to=m[2];
            }
        }
        m=/RADIUS/.exec(this.tmpData.pduType)
        if(m){
            m=/Code: \d+ \((.+)\)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]);
            }
        }   
        
        m=/L2TP/.exec(this.tmpData.pduType)
        if(m){
            m=/l2tp:(\[\w+\]).+\{(.+)\}/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]+': '+m[2]);
                return;
            }
            m=/l2tp:(\[\w+\]).+(\*.+)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]+': '+m[2]);
                return;
            }
            m=/l2tp:(\[TLS\])(.+)/.exec(line)
            if(m){
                this.tmpData.description.a2d(m[1]+': '+m[2]);
                return;
            }
        }   
    },
    endWork:function(){
        this.storePacket();
        this.pb.close();
        this.myPager.total=Math.ceil(this.packetCounter/this.myPager.pageSize);
        this.myPager.render();
    },
    breakWork:function(){
        this.pb.close();
    }
}