// this module is the interface between host and widget. 
// job is to sanitize the function calls, and handle a 
// variation of widget method availability. 
define(["./widgetrouter","jquery"],function(widgetrouter){
	return function questionhandler(domManager,headManager,kernelParams,interactManager){
		// domParams assumed to be jQuery objects - 
		// this is managed in questionhandler
		var qnCore; var question=this;
		var currWidName, currParams, currStudResp;
		var modBaseAddr=kernelParams.yvProdBaseAddr+"mods/";

		function pushQuestion(){
			var studentList=interactManager.getConnectedStudents();
			for (var studentUuid in studentList){
				studentList[studentUuid].relay({
					"title":"execModule",
					"modName":currWidName,
					"modParams":currParams,
					"currAns":currStudResp[studentUuid]
				})
			}
		}
		function sigWa(sig){
			var studentList=interactManager.getConnectedStudents();
			for (var studentUuid in studentList){
				studentList[studentUuid].relay({
					"title":"tranSig",
					"data":sig
				})
			}
		}
		this.execQn=function(widName,params,studResp){
			currWidName=widName;currParams=params;currStudResp=studResp;
			modulePath=kernelParams.yvProdBaseAddr+"mods/"+currWidName+".js";
			// inject yvProdBaseAddr into params.
			var system={}; system.yvProdBaseAddr=kernelParams.yvProdBaseAddr;
			// tidy this up when overhauling core/side params structure
			if(params==null){params={}}; params["system"]=system;
			widgetReadyCallback=function(){
				qnCore=qnCore.widgetObj();
				interactManager.restorePrevAnswered(currStudResp);
				domManager.passWidDom("optDiv",qnCore.responseInput())
				domManager.passWidDom("respDiv",qnCore.responseDom())
				if(typeof(qnCore.widHead)=="function"){
					headManager.set(qnCore.widHead())
				}
				pushQuestion(studentUuid);
				var studentList=interactManager.getConnectedStudents();
				for (var studentUuid in currStudResp){
					qnCore.processResponse(studentUuid,currStudResp[studentUuid]);
				}
				// pass sigaw and sigwa
				if(typeof(qnCore.passSigWa)=="function"){
					qnCore.passSigWa(sigWa);
				}
				if(typeof(qnCore.sigAw)=="function"){
					question.sigAw=qnCore.sigAw;
				}else{
					question.sigAw=function(data){
						console.warn("signal handler does not exist for " + widName);
					}
				}	
			}
			qnCore=new widgetrouter(modulePath,currParams,widgetReadyCallback);
		}
		this.procAns=function(studentUuid,studentAns){
			if(!(studentUuid in currStudResp)){ // check that student has not answered
				currStudResp[studentUuid]=studentAns; 
				qnCore.processResponse(studentUuid,studentAns);
				interactManager.markAnswered(studentUuid);
			} else {
				console.log(studentUuid+" has already answered");
			}
		}
		this.initConnectedStudent=function(studentUuid){
			pushQuestion(studentUuid);
		}
		this.getStudResp=function(){
			return currStudResp;
		}
		this.updateRespDim=function(height,width){
			// check if function exists first. 
			qnCore.updateRespDim(height,width)
		}
	}
})