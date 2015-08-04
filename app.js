/* App Controller */
"use strict";

var app = {
	
	server: '',
	
	config: {
		// Default values, overwrite any in index.js
		host:				'localhost',
		port: 				3000,
		redis_on:			false,
		redis_port:			6379,
		site_title: 		'Node Bingo',
		site_description: 	'Create Cards and Play Bingo With NodeJS',
	},
	
	inc: {
		// Load package dependencies
		fs:			require('fs'),
		hapi: 		require('hapi'),
		mustache: 	require('mustache'),
		redis:		require('redis'),
		q: 			require('q'),
	},

	items: require('./sample_items.js'), // load once
	
	redis_client: false,
	
	
	
	/* Server Startup */
	
	go: function(config){
		// Handle custom config options if passed
		if(config) app.setup_custom_config(config);
		
		// Start Redis if using
		if(app.config.redis_on === true) app.start_redis();
		
		// Connect a server
		app.inc.q.fcall(app.server_conn) 		
			
			// Define routes	
			.then(app.routes) 		
			
			// Start server			
			.then(app.server_start, app.handle_error); // Catch any errors thrown
	},
	
	setup_custom_config: function(config){
		if(!config) throw Error('Custom config options missing.');
		
		var k = Object.keys(config);
			
		for(var i = 0; i < k.length; i++){
			var prop = k[i];
			if(config[prop]) app.config[prop] = config[prop];
		}
	},
		
	server_conn: function(){
		app.server = new app.inc.hapi.Server();
		
		var opts = {
			host: app.config.host, 
			port: app.config.port
		};
		
		return app.server.connection(opts);
	},

	server_start: function(){
		return app.server.start(function () {
			console.log('Server running at:', app.server.info.uri); 
		});
	},
	
	start_redis: function(){
		app.redis_client = app.inc.redis.createClient({ port: app.config.redis_port });
		
		app.redis_client.on('connect', function() {
			console.log('Redis is connected.');
		});
	},
	
	
	
	/* Routing */
	
	routes: function(){
		// These variables available to all templates
		var template_vars = {
			site_title: 		app.config.site_title,
			site_description: 	app.config.site_description,
		};
		
		// Define routes
		var routes = [
			{
				path: '/css/{filename}',
				handler: {
					directory: { path: './public/css' }
				}
			},
			{
				path: '/js/{filename}',
				handler: {
					directory: { path: './public/js' }
				}
			},
			{
				path: '/',
				handler: function(req, reply){
					
					// Additional template variables
					template_vars.bingo_card 	= app.create_card(app.items, true);
					template_vars.num_items 	= app.items.length;
					
					var subtemplates = ['header', 'footer', 'left_sidebar', 'right_sidebar'];
					
					// This looks so effortless but it is also so delicate!
					return app.inc.q.fcall(app.load_view, 'index', template_vars)
					
						// Send HTML
						.then(function(html){
							reply(html);
						}, app.handle_error);
				}
			},
			{
				path: '/new-bingo-call/{sess?}',
				handler: function(req, reply){
					var sessid = req.params.sess;
					if(!sessid) throw Error('No session ID');
					
					var row = app.pick_random_item();
					
					// Return row if Redis is not configured
					if(app.config.redis_on !== true) return reply(row);
					
					// Otherwise make sure next bingo call is unique for user
					return app.inc.q.all([app.inc.q.ninvoke(app.redis_client, 'get', sessid)])
					
						// Parse the session data
						.then(function(sess_data){
							return app.parse_session(sess_data);
						})
						
						// Make sure next bingo call is unique
						.then(function(sess_items){	
							if(typeof sess_items != 'object') throw Error('Invalid session data.'); // JSON required
							
							if(sess_items.length < (app.items.length -1)){
								while(sess_items.indexOf(row.name) != -1) row = app.pick_random_item();
							
								sess_items.push(row.name);
							}
							
							// Or pass an object with a message to deliver
							else row = { success: false, msg: 'End of list!' };
							
							return sess_items;
						})
						
						// Set the new session data
						.then(function(sess_items){
							return app.redis_client.set(sessid, JSON.stringify(sess_items))
						})
						
						// Send the next bingo call to the user	
						.done(function(){					
							reply(row);
						}, app.handle_error);
				}
			}
		];
		
		// Set up routes
		for(var i = 0; i < routes.length; i++){
			app.server.route({
				method: 	'GET',
				path: 		routes[i].path,
				handler: 	routes[i].handler
			});
		}
	},
	


	
	/* Bingo Card */
	
	create_card: function(master_list, center_free){
		if(!center_free) center_free = true;
		
		// Make a copy of the list and start building the HTML
		var temp = master_list.slice(0);
		var html = '<ol class="one-card">';
		
		var rows = 5;
		var cols = 5;
		var middle_x = Math.ceil(rows/2);
		var middle_y = Math.ceil(cols/2);
		
		// Loop through the items and build the card
		for(var i = 1; i <= rows; i++) {
			for(var n = 1; n <= cols; n++){
				
				// Free space
				if(center_free === true && i == middle_x && n == middle_y) {
					html += '<li class="free-space clicked row-'+i+' col-'+n+'">FREE SPACE<div class="clear"></div></li>';
					continue;
				}
				
				var x = Math.floor(Math.random() * (temp.length-1));
				var row = temp[x];
				
				var remove_index = temp.indexOf(row);
				if(remove_index > -1) temp.splice(remove_index, 1);
								
				html += app.one_square(row, i, n);
			}
		}
		
		html += '</ol>';
		
		return html;
	},

	one_square: function(row, i, n){
		if(!row || typeof row.name == 'undefined') throw Error('Square name missing.');
		if(typeof row.desc == 'undefined') throw Error('Square description missing.');
		
		var html = '<li class="row-'+i+' col-'+n+'">';
		
		html += '<h5 class="square-name">'+row.name+'</h5>';
		html += '<div class="square-desc">'+row.desc+'</div><!--/square-desc-->';
		
		html += '<div class="clear"></div>';
		html += '</li>';
		
		return html;
	},
	
	pick_random_item: function(){
		var items_list = app.get_items_list(); 
					
		var x = Math.floor(Math.random() * (items_list.length - 1));
		var row = items_list[x];
			
		return row;
	},
		
	set_session: function(sessid, sess_items){
		if(app.config.redis_on !== true) throw Error('Cannot set session, Redis is not enabled.');
		
		var items =  JSON.stringify(sess_items);
		
		return app.redis_client.set(sessid, items)
	},
						
	parse_session: function(str){
		var sess_data = (str[0] ? str[0] : []);
		
		var sess_items = [];  
		if(!sess_data || sess_data.length < 1) return sess_items;
		
		// Use try/catch in case JSON is invalid
		try {
			sess_items = JSON.parse(str);
		} 
		catch(e) {
			throw Error('Session contains invalid JSON');
		}
		
		return sess_items;
	},

	
	
	
	/* Utils */
	
	get_items_list: function(){
		// Make a copy of the items, an array of objects
		var arr = [];
		
		for(var i = 0; i < app.items.length; i++) {
			arr.push(app.items[i]);
		}
		
		return arr;			
	},
	
	handle_error: function(err){
		console.log('App Error: ', err);
	},
	
	load_view: function(template, vars){		
		// Determine template to use
		var file = __dirname+'/views/'+template+'.html';
		 
		console.log('Loading template', file);
		
		var open_template = app.inc.q.nbind(app.inc.fs.readFile);
		
		return app.inc.q.nfcall(app.inc.fs.readFile, file, 'utf-8')
			.then(function(buf){				
				return app.read_file(buf); // read the file
			})
			.then(function(data){
				return app.render_html(data, vars); // Mustache renders
			})
			.then(undefined, app.handle_error); // Handle any errors		
	},	
	
	read_file: function(buf){
		if(!buf) throw Error('Tried to read file, was empty.');
				
		//~ console.log('returning buffer');
		return buf;
	},
	
	render_html: function(template_html, vars){
		//~ console.log('2 render_html file contents', template_html);
			
		var ret = app.inc.q(app.inc.mustache.render(template_html, vars)); 
		if(!ret) throw Error('Unable to render template.');
		
		//~ console.log('3 render_html returning', ret);
				
		return ret;
	},
	
};

exports.app = app;
