/* SCRIPTS */

(function($){
	$(document).ready(function(){
		nodebingo.layout();
		nodebingo.interactive();
	});

	var nodebingo = {
		config: {
			call_cont:	'#bingo-calls',
			card_el: 	'.one-card',
			play_btn: 	'#new-call',
			print_btn: 	'#print-card',
		},
		
		layout: function(){
			$('.js-only').show();
			
			// Give uniform height to the card squares
			nodebingo.normalize_squares(); 
			
			// Adjust height if layout width changes
			$(window).resize(function(){ 
				nodebingo.normalize_squares(); 
			});
		},
		
		interactive: function(){		
			// Print it
			$(nodebingo.config.print_btn).click(function(){ 
				window.print(); 
			});
			
			// Mark squares
			$(nodebingo.config.card_el).children('li').click(function(){
				if($(this).hasClass('clicked') === true) $(this).removeClass('clicked');
				else $(this).addClass('clicked');
			});
			
			// Play the game
			nodebingo.setup_gameplay();
		},
		
		normalize_squares(){
			var tallest = 0;
			
			// Remove height constraints and set all to height of tallest element
			$(nodebingo.config.card_el).children('li')
				.height('auto')
				.each(function(){
					if($(this).height() > tallest) tallest = $(this).height();
				})
				.height(tallest);			
		},
		
		setup_gameplay: function(){
			// Init gameplay button
			var id = nodebingo.create_sess_id();
			
			var settings = {
				url: 'new-bingo-call/sess-'+id
			};
			
			$(nodebingo.config.play_btn).click(function(){
				$.ajax(settings)
					.success(function(resp){
						// Out of items
						if(typeof resp.success != 'undefined' && resp.success === false)
							return $(nodebingo.config.call_cont).prepend('<p>'+resp.msg+'</p>')
						
						// Record next call
						nodebingo.record_bingo_call(resp);
					})
					.error(function() {
						alert('An error has occurred');
					});
				
			});
		},
		
		create_sess_id: function(){
			var id = '';
			while(id.length < 16) id += Math.random().toString(36).substr(2, 1);
			
			return id;
		},
	
		record_bingo_call: function(details){
			if(typeof details.name == 'undefined' ) throw Error('Cannot record bingo call.');
			
			var html = '<div class="single newest" style="display: none;">'+details.name+'</div>';
			var props = {
				opacity: .5
			};
			
			$(nodebingo.config.call_cont).children('.single').animate(props, 500, 'swing', function(){ 
				$(this).removeClass('newest'); 
			});
			$(nodebingo.config.call_cont).prepend(html).find('.newest').fadeIn('slow');
		},
		
	};

}(jQuery));
