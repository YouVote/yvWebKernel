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
		// tidy this up
		var domParams={}
		if(stemDiv instanceof jQuery){
			domParams.$stemDiv=stemDiv;
		}else{
			domParams.$stemDiv=$(stemDiv);
		}
		if(optDiv instanceof jQuery){
			domParams.$optDiv=optDiv;
		}else{
			domParams.$optDiv=$(optDiv);
		}
		if(respDiv instanceof jQuery){
			domParams.$respDiv=respDiv;
		}else{
			domParams.$respDiv=$(respDiv);
		}
		if(headDom instanceof jQuery){
			domParams.$headDom=headDom;
		}else{
			domParams.$headDom=$(headDom);
		}

		var socketHostObj, studentModelObj, qnHandlerObj, kernelObj=this;
		var connectCalled=false, socketReady=false, kivQn={};

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
				kernelObj.execQn(
					kivQn["qnStem"],kivQn["widgetName"],kivQn["widgetParams"],kivQn["currResp"]
				);
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


		function connect(){ // called on first execQn. possibly make a public method. 
			connectCalled=true;
			studentModelObj=new studentModelEngine(interactManager);
			// pass head here, in kernelParams
			qnHandlerObj=new qnHandlerEngine(domParams,kernelParams,interactManager);
			require.config({paths:{"socketio-server":kernelParams.socketScriptURL}});
			socketHostObj=new socketHostEngine(
				kernelParams,
				interactManager
			);
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
				console.warn("cannot change kernel params after socket opened");
				console.warn("setKernelParams "+ name +"="+value+" is ignored");	
			}
		}
		this.execQn=function(qnStem,widgetName,widgetParams,currResp){
			if(socketReady){ // good to go if socket ready
				require(["ctype"],function(ctype){
					var stemContent=new ctype(qnStem);
					// $stemDiv[0] gets the dom out of a jquery obj.
					stemContent.putInto(domParams.$stemDiv[0]);
				}) 
				qnHandlerObj.execQn(widgetName,widgetParams,currResp);
			} else {
				// possibility that connect() called but socket not ready yet.
				// if so, just update currQn and wait.
				kivQn={"qnStem":qnStem,"widgetName":widgetName,"widgetParams":widgetParams,"currResp":currResp}
				if(!connectCalled){connect();}
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