define([],function(){
	return function(kernelParams,interactManager){
		var socketCore;
		require(["socketio-server"],function(io){
			try{
				socketCore=io.connect(kernelParams.socketServerURL);
			} catch(err){
				interactManager.socketFailCallback("Could not connect to socketio server: "+err)
			}

			socketCore.on('connectType?',function(){ 
				socketCore.emit('connectType=',{'app':'cl','type':'host'}); 
			}); 
			socketCore.on('newGameId=',function(lessonId){
				interactManager.socketPassCallback(lessonId);
			});

			socketCore.on('playerJoin',function(socketId){
				socketCore.emit('relay',{'socketId':socketId,
					'msg':{'title':'studentParams?','baseUrl':kernelParams.yvProdBaseAddr}});
			});
			socketCore.on('playerQuit',function(socketId){
				interactManager.studentLeave(socketId);
			});
			socketCore.on('relay',function(pkt){
				// relay so far conveys two kinds of messages from app
				switch(pkt.msg.title){
					case 'studentParams=':
						interactManager.studentEnter(pkt.socketId, pkt.msg)
						break;
					case 'ans':
						interactManager.studentResp(pkt.socketId, pkt.msg)
						break;
					//todo: add transient state signal (transig) here.
				}
			});

			socketCore.on('serverShutDown',function(msg){
				// inbuilt shutdown command issued by server. 
				// not used yet, built in case necessary in future.
				// could remove if deemed otherwise.
				interactManager.socketFailCallback("Server shutdown signal: "+msg)
			});
			socketCore.on('disconnect',function(msg){
				// connection successful but somehow terminated.
				// possibly from disruption in internet connection
				// or problem with server
				interactManager.socketFailCallback("Server disconnected: "+msg)
			});
			socketCore.on('ping',function(){
				// used to keep socket connection alive
				socketCore.emit('pong',{beat:1}); 
			});
		},function(err){
			interactManager.socketFailCallback("Could not get socketio script: "+err)
		})

		this.relay=function(socketId,msg){
			socketCore.emit('relay',{'socketId':socketId,'msg':msg});
		}
	}
})