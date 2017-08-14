// * list down the entirety of what this is responsible for, 
// and identify if there are any patterns *s 
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
		function sigWa(sig){ 
		// potential for targeted sigWa, for now keep it universal. 
			var studentList=interactManager.getConnectedStudents();
			for (var studentUuid in studentList){
				studentList[studentUuid].relay({"title":"tranSig","data":sig})
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
			// inject yvProdBaseAddr into params.
			var system={}; if(widParams==null){widParams={}}; 
			system.yvProdBaseAddr=kernelParams.yvProdBaseAddr; 
			widParams["system"]=system;
			require([widPath],function(widget){
				widObj=new widget.webEngine(widParams);
				interactManager.restorePrevAnswered(currStudResp);
				// this will change with widget and gadgets. 
				// kiv pattern for now. 
				domManager.passWidDom("optDiv",widObj.responseInput());
				domManager.passWidDom("respDiv",widObj.responseDom());
				// this is the list of interfaces with the widget. 
				if(typeof(widObj.widHead)=="function"){
					headManager.set(widObj.widHead())
				}
				var studentList=interactManager.getConnectedStudents();
				for (var studentUuid in studentList){
					pushQuestion(studentUuid)
				}
				for (var studentUuid in currStudResp){
					widObj.processResponse(studentUuid,currStudResp[studentUuid]);
				}
				if(typeof(widObj.passSigWa)=="function"){
					widObj.passSigWa(sigWa);
				}
				if(typeof(widObj.sigAw)=="function"){
					question.sigAw=widObj.sigAw;
				}else{
					question.sigAw=function(data){
						console.warn("signal handler does not exist for " + widName);
					}
				}	
				if(typeof(widObj.updateRespDim)=="function"){
					question.updateRespDim=widObj.updateRespDim;
				}else{
					question.updateRespDim=function(){
						console.warn(widName+" does not have updateRespDim function");
					}
				}
				if(typeof(widObj.processResponse)=="function"){
					question.procAns=function(studentUuid,studentAns){
						if(!(studentUuid in currStudResp)){ // check that student has not answered
							currStudResp[studentUuid]=studentAns; 
							// check that function exists first 
							widObj.processResponse(studentUuid,studentAns);
							interactManager.markAnswered(studentUuid);
						} else {
							console.log(studentUuid+" has already answered");
						}
					}
				} else {
					question.procAns=function(){
						console.warn(widName+" does not have processResponse function");
					}
				}
			},function(err){
				console.error(err+" when loading widget "+widName)
			});
		}
	}
})