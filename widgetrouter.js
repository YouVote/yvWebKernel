define([],function(){
	// its singular job is to route to the appropriate module based on
	// module name. This allows all the modules to be referred to the same 
	// way in questionHandler. 
	return function widgetrouter(widPath,params,widgetReadyCallback){
		var widObj;
		require([widPath],function(widget){
			widObj=new widget.webEngine(params);
			widgetReadyCallback()
		});
		this.widgetObj=function(){return widObj;}
	}
})