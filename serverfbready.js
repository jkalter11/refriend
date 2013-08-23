var http = require('http');
var httpd = http.createServer(handler);
var io = require('socket.io').listen(httpd);
var fs = require('fs');
var path = require('path');
var queue = [];
var port = process.env.PORT || 4000;
httpd.listen(port);
function handler(req, res)
{
    if(req.url === "/channel.html" || req.url === "/bootstrap.min.css" || req.url === "/bootstrap.min.js" || req.url === "/FBLogo.png" || req.url === "/loading.gif" || req.url === "/favicon.ico") {
	var file = path.normalize('.' + req.url);
	console.log('Trying to serve', file);
	function reportError(err) {
	    console.log(err);
	    res.writeHead(500);
	    res.end('Internal Server Error');
	}
		fs.stat(file, function(err, stat) {
		    var rs;
		    if (err) {
			return reportError(err);
		    }
		    if (stat.isDirectory()) {
			res.writeHead(403); res.end('Forbidden');
		    } else {
			rs = fs.createReadStream(file);
			rs.on('error', reportError);
			if(req.url == "/bootstrap.min.css")
			    res.setHeader("Content-Type", "text/css");
			if(req.url == "/bootstrap.min.js")
			    res.setHeader("Content-Type", "application/javascript");
			res.writeHead(200);
			rs.pipe(res);
		    }
		});
	    

    }
    else {
    fs.readFile(__dirname + '/indexfbready.html',
    function(err, data)
    {
	if (err)
	{
	    res.writeHead(500);
	    return res.end('Error loading index.html');
	}
	res.writeHead(200);
	res.end(data);
    });
    }
}

//config to prevent websockets (required for heroku)
io.configure(function () { 
  io.set("transports", ["xhr-polling"]); 
  io.set("polling duration", 10); 
});

io.sockets.on('connection', function (socket) 
{
   
//response to message
    socket.on('clientMessage', function(content) {
	socket.emit('serverMessage', 'You said: ' + content);
	socket.get('room', function(err, room) {
	    if (err) { throw err; }
	    var broadcast = socket.broadcast;
	    var message = content;
	    if (room) {
		broadcast.to(room);
		broadcast.emit('serverMessage', 'Friend said: ' + message);
	    }
	});
    });

//response to typing
    socket.on('typing', function() {
	socket.get('room', function(err, room) {
	    if (err) { throw err; }
	    var broadcast = socket.broadcast;
	    if (room) {
		broadcast.to(room);
		broadcast.emit('typing', true);
	    }
	});
    });

//response to typingNot
    socket.on('typingNot', function() {
	socket.get('room', function(err, room) {
	    if (err) { throw err; }
	    var broadcast = socket.broadcast;
	    if (room) {
		broadcast.to(room);
		broadcast.emit('typingNot', true);
	    }
	});
    });

//response to login
    socket.on('login', function(id_username) {
	socket.set('id', id_username[0], function(err) {
	    if (err) {throw err;}
	});
	socket.set('username', id_username[1], function(err) {
	    if (err) { throw err;} 
	});
//	socket.emit('serverMessage', 'Currently logged in as ' + id_username[1]);
    });

//response to friends
    socket.on('friends', function(friends) {
	var friendList = [];
	for (var i = 0; i < friends.length; i++) {
	    friendList[i] = friends[i].id;
	}
	socket.set('friends', friendList, function(err) {
	    if (err) {throw err;}
	});
    });

//response to entering queue
    socket.on('queueEnter', function(ready) {
	if (queue.length === 0) {
	    socket.get('id', function(err, id) {
		if (err) {throw err;}
		var user = {fbId: id, socketId: socket.id};
		queue[0] = user;
	    });
	} else {
	    socket.emit('goCheckQueue', 'boo');
	}
    });

    socket.on('queueEnterSad', function(sad) {
	socket.get('id', function(err, id) {
	    if (err) {throw err;}
	    var user = {fbId: id, socketId: socket.id};
	    queue.push(user);
	});
    });

    socket.on('enterChat', function(partner) {
	console.log(partner);
	var removed = null;
	for (var i = 0; i < queue.length; i++) {
	    if(queue[i].socketId == partner) {
		removed = queue.splice(i, 1);
		console.log('queue is');
		console.log(queue);
		socket.emit('goodToGo', partner);
	    }
	}
	if (removed == null) {
	    console.log('partner not there anymore');
	    socket.emit('goodToGo', false);
	}
    });

    socket.on('enterChatReal', function(partner) {
		io.sockets.socket(partner).emit('joinRoom', socket.id);
		socket.get('room', function(err, oldRoom) {
		    if (err) { throw err; }
		    socket.set('room', socket.id, function(err) {
			if (err) { throw err; }
			socket.join(socket.id);
			if (oldRoom && oldRoom !== socket.id) {
			    socket.leave(oldRoom);
			}
		    });
		});
		socket.emit('chatReady', true);
    });
	     

    socket.on('queueCheck', function(ehh) {
	socket.get('friends', function(err, friends) {
	    if (err) {throw err;}
	    socket.emit('queueCheckGo', [queue, friends]);
	});
    });

//response to being the parter that's found
    socket.on('joinRoom', function(room) {
	socket.get('room', function(err, oldRoom) {
	    if (err) { throw err; }
	    socket.set('room', room, function(err) {
		if (err) { throw err; }
		socket.join(room);
		if (oldRoom && oldRoom !== room) {
		    socket.leave(oldRoom);
		}
	    });
	});
	socket.emit('chatReady', true);
    });

//response to reveal
    socket.on('reveal', function() {
	socket.get('room', function(err, room) {
	    if (err) {throw err;}
	    if(room) {
		socket.broadcast.to(room);
		socket.broadcast.emit('reveal', true);
	    }
	});
    });

//response to bothRevealed
    socket.on('bothRevealed', function() {
	socket.get('username', function(err, username) {
	    if (err) {throw err;}
	    socket.get('id', function(err, id) {
		if(err) {throw err;}
		socket.get('room', function(err, room) {
		    if(err) {throw err;}
		    if(room) {
			var user = [username, id];
			socket.broadcast.to(room);
			socket.broadcast.emit('revealTime', true);
			socket.broadcast.emit('bothRevealed', user);
		    }
		});
	    });
	});
    });

//response to revealMe
    socket.on('revealMe', function() {
	socket.get('username', function(err, username) {
	    if (err) {throw err;}
	    socket.get('id', function(err, id) {
		if(err) {throw err;}
		socket.get('room', function(err, room) {
		    if(err) {throw err;}
		    if(room) {
			var user = [username, id];
			socket.broadcast.to(room);
			socket.broadcast.emit('bothRevealed', user);
		    }
		});
	    });
	});
    });

//response to disconnectMe
    socket.on('disconnectMe', function() {
	socket.get('room', function(err, room) {
	    if (err) { throw err; }
	    var broadcast = socket.broadcast;
	    if (room) {
		broadcast.to(room);
		broadcast.emit('friendDisconnect', 'Your friend has disconnected');	
		socket.leave(room);
	    }
	    socket.get('id', function(err, id) {
	 	if(err) {throw err;}
	 	for (var i=0; i<queue.length; i++) {
		    if (queue[i].socketId == socket.id || queue[i].fbId == id) {
			var removed = queue.splice(i, 1);
			break;
		    }
		}
	    });		

	});
    });

//response to disconnectMe2
    socket.on('disconnectMe2', function() {
	socket.get('room', function(err, room) {
	    if (err) {throw err;}
	    if (room)
		socket.leave(room);
	
	    socket.get('id', function(err, id) {
	 	if(err) {throw err;}
	 	for (var i=0; i<queue.length; i++) {
		    if (queue[i].socketId == socket.id || queue[i].fbId == id) {
			var removed = queue.splice(i, 1);
			break;
		    }
		}
	    }); 
	});
    });

//response to disconnect
    socket.on('disconnect', function() {
	socket.get('room', function(err, room) {
	    if (err) { throw err; }
	    var broadcast = socket.broadcast;
	    if (room) {
		broadcast.to(room);
		broadcast.emit('friendDisconnect', 'Your friend has disconnected');	
		socket.leave(room);
	    }
	     //check if in queue and remove if is
	    socket.get('id', function(err, id) {
	 	if(err) {throw err;}
	 	for (var i=0; i<queue.length; i++) {
		    if (queue[i].socketId == socket.id || queue[i].fbId == id) {
			var removed = queue.splice(i, 1);
			break;
		    }
		}
	    });
		
	});
    });
});
