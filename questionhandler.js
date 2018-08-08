// * list down the entirety of what this is responsible for, 
// and identify if there are any patterns *
// this module is the interface between host and widget. 
// job is to sanitize the function calls, and handle a 
// variation of widget method availability. 
// the other job is to manage the nitty gritty of question
// administration - responding to new students enter,
// and appropriately broadcasting signals. 
define(["jquery"],function(){
	return function questionhandler(domManager,headManager,kernelParams,interactManager){
		var question=this;
		var currWidName, currWidParams, currStudResp;
		var modBaseAddr=kernelParams.yvProdBaseAddr+"mods/";

		function pushQuestion(studentUuid){
			var studentList=interactManager.getConnectedStudents();
			studentList[studentUuid].relay({
				"title":"execModule",
				"modName":currWidName,
				"modParams":currWidParams,
				"currAns":currStudResp[studentUuid]
			})
		} 
		// broadcast sigWa
		function sigWaBc(sig){
			var studentList=interactManager.getConnectedStudents();
			for (var studentUuid in studentList){
				studentList[studentUuid].relay({"title":"tranSig","data":sig})
			}
		}
		// targeted sigWa
		function sigWaTg(targetUuid,sig){
			var studentList=interactManager.getConnectedStudents();
			if(targetUuid in studentList){
				studentList[targetUuid].relay({"title":"tranSig","data":sig}) 
			}else{
				// consider if it may be in another list - connected before, 
				// but just disconnected for a while 
				console.warn("Uuid "+targetUuid+" not found in studentList");
			}
		}
		// called as studentEnter by socketHost
		this.initConnectedStudent=function(studentUuid){
			pushQuestion(studentUuid);
		}
		// passed through main, called by lessonModel when changing qn. 
		this.getStudResp=function(){
			return currStudResp;
		}

		this.execQn=function(widName,widParams,studResp){
			var widObj; currWidName=widName;
			currWidParams=widParams;currStudResp=studResp;
			widPath=kernelParams.yvProdBaseAddr+"mods/"+currWidName+".js";
			// inject yvProdBaseAddr into params in the "system" key.
			// widParams is possibly an object with "core" and side" keys in it. 
			// also, typeof(array) return object hence the or condition. 
			if(typeof(widParams)!="object"||Array.isArray(widParams)){widParams={core:widParams}}; 
			var system={yvProdBaseAddr:kernelParams.yvProdBaseAddr}; 
			widParams["system"]=system;
			require([widPath],function(widget){
				if(typeof(widget)=="object" && typeof(widget.webEngine)=="function"){
					widObj=new widget.webEngine(widParams);
				}else{
					widObj={};
					console.warn(widName+" not properly defined");
				}
				interactManager.restorePrevAnswered(currStudResp);
				// this is the list of interfaces with the widget. 
				if(typeof(widObj.widHead)=="function"){
					headManager.set(widObj.widHead())
				}
				// this will change with widget and gadgets. 
				// kiv pattern for now. 
				if(typeof(widObj.passInputDom)=="function"){
					domManager.passWidDom("optDiv",widObj.passInputDom,null);
				}else{
					domManager.passWidDom("optDiv",null,null);
					console.warn(widName+".passInputDom() not specified");
				}
				if(typeof(widObj.passRespDom)=="function"){
					if(typeof(widObj.updateRespDim)=="function"){
						domManager.passWidDom("respDiv",widObj.passRespDom,widObj.updateRespDim);
					}else{
						domManager.passWidDom("respDiv",widObj.passRespDom,null);
						console.warn(widName+".updateRespDim() not specified");
					}
				}else{
					domManager.passWidDom("respDiv",null,null);
					console.warn(widName+".passRespDom() not specified");
				}

				var studentList=interactManager.getConnectedStudents();
				for (var studentUuid in studentList){
					pushQuestion(studentUuid)
				}

				if(typeof(widObj.processResponse)=="function"){
					for (var studentUuid in currStudResp){
						widObj.processResponse(studentUuid,currStudResp[studentUuid]);
					}
					question.procAns=function(studentUuid,studentAns){
						// checks that student has not answered
						if(!(studentUuid in currStudResp)){ 
							currStudResp[studentUuid]=studentAns; 
							widObj.processResponse(studentUuid,studentAns);
							interactManager.markAnswered(studentUuid);
						} else {
							console.warn(studentUuid+" has already answered");
						}
					}
				} else {
					question.procAns=function(){
						console.warn(widName+".processResponse() method does not exist");
					}
				}

				if(typeof(widObj.passSigWaBroadcast)=="function"){
					widObj.passSigWaBroadcast(sigWaBc);
				}
				if(typeof(widObj.passSigWaTarget)=="function"){
					widObj.passSigWaTarget(sigWaTg);
				}
				if(typeof(widObj.sigAw)=="function"){
					question.sigAw=widObj.sigAw;
				}else{
					question.sigAw=function(data){
						console.warn(widName+" signal handler does not exist for " );
					}
				}	
				if(typeof(widObj.updateRespDim)=="function"){
					question.updateRespDim=widObj.updateRespDim;
				}else{
					question.updateRespDim=function(){
						console.warn(widName+".updateRespDim() method does not exist");
					}
				}
			},function(err){
				console.error(err+" when loading widget "+widName)
			});
		}
	}
})