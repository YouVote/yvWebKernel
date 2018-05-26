// The aim of this module:
// allow execution of YouVote Questions, simply from supplying 
// stemDiv, optDiv and respDiv.
//
// Responsible for: 
// 1. managing socket connection
// 2. keeping track of student in session
// 3. executing questions
// 4. interfacing and managing web DOM 
//
// Also
// - interfaces with external for view and lesson management
// - holds default params but allows changes
// - sets yvBaseProdUrl
// 
// Potential future upgrades:
// 1. side params, create params system 
// 2. select user/answer
// 3. mark answer

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
			// testing http on gh-pages
			// socketScriptURL:"https://socketio-server-youvote.a3c1.starter-us-west-1.openshiftapps.com/socket.io/socket.io",
			// socketServerURL:"https://socketio-server-youvote.a3c1.starter-us-west-1.openshiftapps.com/",
			socketScriptURL:"http://socketio-server-youvote.a3c1.starter-us-west-1.openshiftapps.com/socket.io/socket.io",
			socketServerURL:"http://socketio-server-youvote.a3c1.starter-us-west-1.openshiftapps.com/",
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
			sigAw:function(socketId,data){
				var studentUuid=studentModelObj.socIdToUuid(socketId);
				qnHandlerObj.sigAw(studentUuid,data.data);
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
			}
		};
		
		// Tidy this up when gadget and widlets implemented.  
		// takes the dom passed by web, and manages what the widget
		// is allowed to do to it. passed as a function into questionhanler.
		// the function will change with widlets and gadgets.
		var domManager=new (function(){
			// will change again when we have widlet and gadgets. 
			var webDom={"stemDiv":$('div'),"optDiv":$('div'),"respDiv":$('div'),"headDom":$('head')}
			var widDom={};
			this.passWebDom=function(domName,domObj){
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

		var headManager=new (function(head){
			var $head;
			if(head instanceof jQuery){
				$head=head;
			}else{
				$head=$(head);
			}
			var $currWidHead=[]; 
			this.clear=function(){ 
				while ($currWidHead.length>0){
					$currWidHead[$currWidHead.length-1].remove()
					$currWidHead.pop();
				}
			}
			this.set=function(newStyle){ 
				if(newStyle instanceof jQuery){
					$newStyle=newStyle;
				}else{
					$newStyle=$(newStyle);
				}
				$newStyle.appendTo($head);
				$currWidHead.push($newStyle)
			}
		})(headDom);

		this.connect=function(){
			if(!connectCalled){
				headManager.clear();
				studentModelObj=new studentModelEngine(interactManager);
				qnHandlerObj=new qnHandlerEngine(domManager,headManager,kernelParams,interactManager);
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
				// put qnStem
				require(["ctype"],function(ctype){
					var stemContent=new ctype(qnStem);
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