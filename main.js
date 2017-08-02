// The aim of this module:
// allow execution of YouVote Questions, simply from supplying 
// stemDiv, optDiv and respDiv.
//
// Responsible for: 
// 1. managing socket connection
// 2. keeping track of student in session
// 3. executing questions
//
// NOT Responsible for:
// * View implementation. That is passed as a function into
// kernelParams, which are triggered by the appropriate events.
//
// Also
// - interfaces with external for view and lesson management
// - holds default params but allows changes
// 
// Potential future upgrades:
// 1. include optional question settings
// 2. transient state signal (transig)
// 3. select user/answer
// 4. mark answer

require.config({ urlArgs: "v=" +  (new Date()).getTime() });

define(["./sockethost","./studentmodel","./questionhandler"],
function(socketHostEngine,studentModelEngine,qnHandlerEngine){
	return function(stemDiv,optDiv,respDiv,headDom){ 
		var socketHostObj, studentModelObj, qnHandlerObj, kernelObj=this;
		var connectCalled=false, socketReady=false, kivQn=null;

		// initialized to the following default values, 
		// values be changed from caller through setKernelParam.
		var kernelParams={ 
			// used for socketHost
			socketScriptURL:"https://avalon-gabrielwu84.rhcloud.com/socket.io/socket.io",
			socketServerURL:"https://avalon-gabrielwu84.rhcloud.com:8443",
			// used in qnHandler, 
			yvWebKernelBaseAddr:"https://youvote.github.io/clicker-web/yvWebKernel/",
			yvProdBaseAddr:"https://youvote.github.io/clicker-prod/",
			// used in interactManager
			onConnectPass:function(lessonId){}, 
			onConnectFail:function(errMsg){},
			viewAddStudent:function(studentUuid){},
			viewMarkReconnected:function(studentUuid){},
			viewMarkDisconnected:function(studentUuid){},
			viewMarkAnswered:function(studentUuid){},
			viewRestorePrevAnswered:function(currResp){},
		};
		var interactManager={
			// called in socketHost
			socketPassCallback:function(lessonId){
				console.log("CONNECTED! \nLessonID: "+lessonId)
				socketReady=true;
				if(kivQn!=null){ // kivQn==null when connect() is called directly
					kernelObj.execQn( // kivQn!=null when connect() is called through execQn()
						kivQn["qnStem"],kivQn["widgetName"],kivQn["widgetParams"],kivQn["currResp"]
					);
				}
				kernelParams.onConnectPass(lessonId);
				kivQn={};
			},
			socketFailCallback:function(errMsg){
				console.log(errMsg);
				kernelParams.onConnectFail(errMsg);
			},
			studentEnter:function(socketId,data){
				var student=studentModelObj.studentEnter(socketId,data.studentName,data.uuid);
				qnHandlerObj.initConnectedStudent(data.uuid);
			},
			studentLeave:function(socketId){
				var studentUuid=studentModelObj.socIdToUuid(socketId);
				studentModelObj.studentLeave(studentUuid);
			},
			studentResp:function(socketId,data){
				var studentUuid=studentModelObj.socIdToUuid(socketId);
				qnHandlerObj.procAns(studentUuid,data.data);
			},

			// called in studentModel
			addStudent:function(studentUuid){
				kernelParams.viewAddStudent(studentUuid);
			},
			markReconnected:function(studentUuid){
				kernelParams.viewMarkReconnected(studentUuid);
			},
			markDisconnected:function(studentUuid){
				kernelParams.viewMarkDisconnected(studentUuid);			
			},
			socketRelay:function(socketId,data){
				socketHostObj.relay(socketId,data);
			},

			// called in qnHandler
			markAnswered:function(studentUuid){
				kernelParams.viewMarkAnswered(studentUuid);	
			},
			restorePrevAnswered:function(currResp){ 
			// used when switching to a previously attempted question
				kernelParams.viewRestorePrevAnswered(currResp);	
			},
			getConnectedStudents:function(){
				return studentModelObj.getStudents();
			},
		};
		var domManager=new (function(){
			// var domLive={};
			// var domParams={"stemDiv":$('div'),"optDiv":$('div'),"respDiv":$('div'),"headDom":$('head')}
			// var webDom, widDom;
			// passWebDom, passWidDom;
			// getHeadDom()
			// will change again when we have widlet and gadgets. 
			var webDom={"stemDiv":$('div'),"optDiv":$('div'),"respDiv":$('div'),"headDom":$('head')}
			var widDom={};
			// for(var domName in domParams){
			// 	domLive[domName]=false;
			// }
			// this.setDom=function(domName,domObj){
			// 	var newDomObj;
			// 	if(domName in domParams){
			// 		if(domObj instanceof jQuery){
			// 			newDomObj=domObj;
			// 		}else{
			// 			newDomObj=$(domObj);
			// 		}
			// 		// TODO: check that typeof domobj is same. 
			// 		if(domLive[domName]){ // swap DOM content 
			// 			// sometimes dom is updated in between swaps. debug this. 
			// 			var oldDomHtml=domParams[domName].html();
   			//			newDomObj.html(oldDomHtml);
			// 		}
			// 		domParams[domName]=newDomObj;
			// 	}else{
			// 		console.warn("WARNING: requested DOM "+domName+" is not a valid domParam.");
			// 	}
			// }
			// this.getDom=function(domName){
			// 	if(domName in domLive){
			// 		domLive[domName]=true;
			// 	}else{
			// 		console.warn("WARNING: requested DOM "+domName+" is not a valid domParam.");
			// 	}
			// 	return domParams[domName];
			// }
			this.passWebDom=function(domName,domObj){
				console.log("webDom "+domName)
				var newDomObj;
				if(domName in webDom){
					if(domObj instanceof jQuery){
						newDomObj=domObj;
					}else{
						newDomObj=$(domObj);
					}
					webDom[domName]=newDomObj;
					if(domName in widDom){ // swap DOM content 
						webDom[domName].html(widDom[domName]);
					}
				}else{
					console.warn("WARNING: requested DOM "+domName+" is not a valid webDom.");
				}
			}
			this.passWidDom=function(domName,domObj){
				console.log("widDom "+domName)
				if(domName in webDom){
					widDom[domName]=domObj;
					webDom[domName].html(widDom[domName]);
				}else{
					console.warn("WARNING: requested DOM "+domName+" is not a valid webDom.");
				}
			}
			this.getHeadDom=function(){
				return webDom["headDom"];
			}
		})();
		domManager.passWebDom("stemDiv",stemDiv);
		domManager.passWebDom("optDiv",optDiv);
		domManager.passWebDom("respDiv",respDiv);
		domManager.passWebDom("headDom",headDom);

		// function connect(){ // called on first execQn. possibly make a public method. 
		this.connect=function(){
			if(!connectCalled){
				studentModelObj=new studentModelEngine(interactManager);
				// pass head here, in kernelParams
				// qnHandlerObj=new qnHandlerEngine(domParams,kernelParams,interactManager);
				qnHandlerObj=new qnHandlerEngine(domManager,kernelParams,interactManager);
				require.config({paths:{"socketio-server":kernelParams.socketScriptURL}});
				socketHostObj=new socketHostEngine(
					kernelParams,
					interactManager
				);
				connectCalled=true;
			}else{
				console.warn("WARNING: connect() already called.");
			}
		}
		this.setKernelParam=function(name,value){
		// can only be used before connect is called, has no effect otherwise
			if(typeof(kernelParams[name])!==typeof(value)){ 
				if(typeof(kernelParams[name])!="undefined"){
					console.warn("WARNING: param '"+name+"' is not of correct type.");
					console.warn("Should be of type "+ typeof(kernelParams[name]));
					console.warn("but it is of type "+ typeof(value));
				} else {
					console.warn("WARNING: param '"+name+"' is not a valid kernelParam.");
				}
			}
			if(!connectCalled){
				kernelParams[name]=value;
			}else{
				console.warn("WARNING: cannot change kernel params after socket opened.");
				console.warn("setKernelParams "+ name +"="+value+" is ignored");	
			}
		}
		this.swapDom=function(domName,domObj){
			domManager.passWebDom(domName,domObj);
		}
		this.execQn=function(qnStem,widgetName,widgetParams,currResp){
			if(socketReady){ // good to go if socket ready
				require(["ctype"],function(ctype){
					var stemContent=new ctype(qnStem);
					// $stemDiv[0] gets the dom out of a jquery obj.
					// stemContent.putInto(domParams.$stemDiv[0]);
					// stemContent.putInto(domManager.getDom("stemDiv")[0]);
					// TODO: take a long hard look at ctype
					var stemDiv=document.createElement("div");
					stemContent.putInto(stemDiv);
					domManager.passWidDom("stemDiv",stemDiv);
				}) 
				qnHandlerObj.execQn(widgetName,widgetParams,currResp);
			} else {
				// possibility that connect() called but socket not ready yet.
				// if so, just update currQn and wait.
				kivQn={"qnStem":qnStem,"widgetName":widgetName,"widgetParams":widgetParams,"currResp":currResp}
				// if(!connectCalled){connect();}
				if(!connectCalled){this.connect();}
			}
		}
		this.getQnResp=function(){
			if(connectCalled){
				return qnHandlerObj.getStudResp();
			}else{
				console.warn("WARNING: calling yvWebKernel.getQnResp()\nwhen no question has been run yet.")
			}
		}
	}
})