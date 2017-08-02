// this module is the interface between host and widget. 
// job is to sanitize the function calls, and handle a 
// variation of widget method availability. 
define(["./widgetrouter","jquery"],function(widgetrouter){
	return function questionhandler(domManager,kernelParams,interactManager){
		// domParams assumed to be jQuery objects - 
		// this is managed in questionhandler

		var qnCore;
		var currWidName, currParams, currStudResp;
		// var $qnOptsDiv=domParams.$optDiv;
		// var $qnRespDiv=domParams.$respDiv;
		var modBaseAddr=kernelParams.yvProdBaseAddr+"mods/";

		var headManager=new function($head){
			// var $currPermStyle
			// currwidstyle should be an array of jquery styles. 
			var $currWidHead=null;
			this.setPerm=function(newStyle){
				$head.append(newStyle)
			}
			this.clear=function(){ // simply clear
				// check if exists [loop over and remove]
				if($currWidHead!=null){
					$currWidHead.remove();
				}
			}
			this.set=function(newStyle){ // setItem
				// generalize this to check if array
				// check if newStyle is array.
				if(typeof(newStyle)=="string"){
					$newStyle=$(newStyle);
				} else {
				// check if it is jquery obj.
					$newStyle=newStyle;
				}
				$newStyle.appendTo($head);
				// push.
				$currWidHead=$newStyle;
			}
		// }(domParams.$headDom);
		// }(domParams("headDom"));
		}(domManager.getHeadDom());
		function pushQuestion(studentUuid){
			var studentList=interactManager.getConnectedStudents();
			studentList[studentUuid].relay({
				"title":"execModule",
				"modName":currWidName,
				"modParams":currParams,
				"currAns":currStudResp[studentUuid]
			})
		}
		this.execQn=function(widName,params,studResp){
			currWidName=widName;currParams=params;currStudResp=studResp;
			headManager.clear();
			modulePath=kernelParams.yvProdBaseAddr+"mods/"+currWidName+".js";

			widgetReadyCallback=function(){
				qnCore=qnCore.widgetObj();
				interactManager.restorePrevAnswered(currStudResp);
				// $qnOptsDiv.html(qnCore.responseInput());
				// $qnRespDiv.html(qnCore.responseDom());
				// possibly use update dom instead of domParams. but head will be treated differently. 
				// domParams("optDiv").html(qnCore.responseInput());
				// domParams("respDiv").html(qnCore.responseDom());
				domManager.passWidDom("optDiv",qnCore.responseInput())
				domManager.passWidDom("respDiv",qnCore.responseDom())
				if(typeof(qnCore.widHead)=="function"){
					headManager.set(qnCore.widHead())
				}
				var studentList=interactManager.getConnectedStudents();
				for (var studentUuid in studentList){
					pushQuestion(studentUuid)
				}
				for (var studentUuid in currStudResp){
					qnCore.processResponse(studentUuid,currStudResp[studentUuid]);
				}
				// pass sigaw and sigwa
				// if(typeof(currWidObj.sigAw)=="function"){
				// 	currWidObj.sigAw(kernelParams.sigAw);
				// }
				// if(typeof(currWidObj.sigWa)=="function"){
				// 	question.sigWa=currWidObj.sigWa;
				// }else{
				// 	question.sigWa=function(data){
				// 		console.warn("signal handler does not exist for " + widName);
				// 	}
				// }
				// widObj=currWidObj;	
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