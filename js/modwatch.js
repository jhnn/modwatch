var fontCaviarDreams;
var currentSubreddit;

function preload() {
	fontCaviarDreams = loadFont('fonts/CaviarDreams.ttf');
}	

function setup() {
	var canvas = createCanvas(720, 720);
	canvas.parent('canvasContainer');
	clearCanvas();
	
	textFont(fontCaviarDreams);
	textAlign(CENTER);
	colorMode(HSL);
	
	drawInformation("modwatch for reddit", "track mod related subreddits");
}

function draw() {
	
}

$('#domainform').on('submit', function(event){
	event.preventDefault();
	
	// Clear the buttons and result div
	$("#saveimage").html("");
	$("#showraw").html("");
	$("#rawresults").html("");

	// This query is merely to get the correct case/capitalization of the subreddit
	var subredditurl = "http://www.reddit.com/r/" + $('#searchsubreddit').val() + "/about.json";
	$.getJSON(subredditurl, function foo(data) {
		drawInformation("loading...", "searching for mods");
	})
	.then(function(data){
			var fullurl = data.data.url;
			currentSubreddit = fullurl.substring(0, fullurl.length - 1);
			searchsubreddit(currentSubreddit);
		},
		function(error){
			// The subreddit may not exist or be unavailable due to e.g. quarantine
			if(error.status == 0){
				drawInformation("error", "could not find /r/" + $('#searchsubreddit').val());
			} else {
				drawInformation("error " + error.status, error.statusText);
			}
		}
	);
});

// Search the moderators of a subreddit
function searchsubreddit(subreddit){
	var fullurl = "http://www.reddit.com" + subreddit + "/about/moderators.json?jsonp=?";
	var modnames = [];

	$.getJSON(fullurl, function foo(data) {
		$.each( data.data.children, function (i, post) {
			// Exclude this bot, skews the data
			if(post.name != "AutoModerator"){
				modnames.push(post.name);
			}
		})
	})
	.then(function() {
		drawInformation("searching for mods", "finished collecting mods");
		processmoderators(modnames);
	}, function() { alert("error trying to read a subreddits"); });
}

// Look up the subreddit each mod is moderating
function processmoderators(modnames){
	drawInformation("finished collecting mods", "searching for subreddits");
	var submodmap = new Map();
	// Procede recoursively, easier to track progress
	recProcMods(modnames, modnames.length - 1, submodmap);
}

function recProcMods(modnames, acc, submodmap){
	// Look up data for a mod in the database or get from the web
	$.getJSON("../php/modwatchdb.php?u=" + modnames[acc], function (data) {
		$.each( data.subreddits, function (i, subreddit) {
			subreddit = "/r/" + subreddit;
			// Create new entry in the map or increase counter
			if(submodmap.has(subreddit)){
				var number = submodmap.get(subreddit);
				submodmap.set(subreddit, number + 1);
			} else {
				submodmap.set(subreddit, 1);
			}
		})
	})
	.then(function() {
		var processedMods = modnames.length - acc;
		drawInformation("processedMods " + processedMods + "/" + modnames.length, "subreddits " + submodmap.size);
		if(acc > 0){
			// Continue if there are still mods to process
			recProcMods(modnames, acc - 1, submodmap);
		}
		else{
			// Get the size of the current subreddit and remove it from the map
			var curSubSize = submodmap.get(currentSubreddit);
			submodmap.delete(currentSubreddit);
			
			// Put all map entries with multiplicity larger one in a list and sort by multiplicity
			var sortedsubs = [];
			for (var [key, value] of submodmap.entries()) {
				if(value > 1){
					sortedsubs.push([key, value])
				}
			};
			sortedsubs.sort(function(a, b) {
				return b[1] - a[1];
			});
			
			// Draw only the top 10 entries
			var drawnsubs = sortedsubs.slice(0,10);
			var angle = 0;
			var deltaAngle = 2 * Math.PI / drawnsubs.length;
			
			clearCanvas();
			for(var j = 0; j < drawnsubs.length; j++){
				var dx = Math.sin(angle) * 250;
				var dy = Math.cos(angle) * 250;
				
				var subSize = drawnsubs[j][1];
				drawRelatedSubreddit(drawnsubs[j][0], subSize, subSize/curSubSize, dx, dy);
				angle = angle + deltaAngle;
			}
			
			drawSubreddit(currentSubreddit, curSubSize);
			
			// Create buttons to save image and expand raw data
			$("#saveimage").html("<button id='saveimagebutton' onclick='saveImage()'>Save image</button>");
			$("#showraw").html("<button id='showrawbutton' onclick='expandRawData()'>Show raw data</button>");
			for(var l = 0; l < sortedsubs.length; l++){
				$("#rawresults").append('<p>' + sortedsubs[l][0] + ": " + sortedsubs[l][1] + '</p>');
			}
		}
	}, function() { alert("error trying to read a redditors profile"); });
}

function saveImage(){
	saveCanvas("modwatch_"+currentSubreddit.substring(3), 'png');
}

function expandRawData() {
	$("#rawresults").slideToggle(100);
};

function drawInformation(infotop, infobot){
	clearCanvas();
	drawSubreddit(infotop, infobot);
	
	stroke(0, 0, 90);
	strokeWeight(4);
	line(180, 360, 540, 360);
	noStroke();
}

function drawSubreddit(name, size){
	fill(0, 0, 30);
	ellipse(360, 360, 200, 200);
	fill(0, 0, 250);
	textSize(20);
	text(name, 360, 355);
	text(size, 360, 380);
}

function drawRelatedSubreddit(name, size, relSize, deltaX, deltaY){
	var rndColor = random(256);
	var px = 360 + deltaX;
	var py = 360 + deltaY;
	
	stroke(rndColor, 45, 95);
	strokeWeight(100 * relSize);
	line(360,360, px, py);
	noStroke();
	
	fill(rndColor, 80, 90);
	ellipse(px, py, 200 * relSize, 200 * relSize);
	drawText(px, py, name, size);
}

function drawText(posx, posy, uppertext, lowertext){
	textSize(18);
	fill(0, 0, 0);
	text(uppertext, posx, posy);
	text(lowertext, posx, posy + 30);
}

function clearCanvas() {
	background(0,0,60);
	noStroke();
}