var fontCaviarDreams;
var currentSubreddit;
var currentSubredditSize;
var currentRunID = 0;

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
	var runID = ++currentRunID;
	
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
			searchsubreddit(currentSubreddit, runID);
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
function searchsubreddit(subreddit, runID){
	if(runID != currentRunID){
		return;
	}
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
		processmoderators(modnames, runID);
	}, function() { alert("error trying to read a subreddits"); });
}

// Look up the subreddit each mod is moderating
function processmoderators(modnames, runID){
	if(runID != currentRunID){
		return;
	}
	drawInformation("finished collecting mods", "searching for subreddits");
	var submodmap = new Map();
	currentSubredditSize = modnames.length;
	var acc = currentSubredditSize - 1;
	drawnsubreddits = Array();
	
	processmoderatorsrecoursive(modnames, submodmap, acc, runID);
}

function processmoderatorsrecoursive( modnames, submodmap, acc, runID){
	if(runID != currentRunID){
		return;
	}
	if(acc >= 0){
		$.getJSON("../php/modwatchdb.php?u=" + modnames[acc], function (data) {
			$.each( data.subreddits, function (i, data) {
				data = "/r/" + data;
				// Create new entry in the map or increase counter
				if(submodmap.has(data)){
					var number = submodmap.get(data) + 1;
					submodmap.set(data, number);
					updateDrawnSubreddits(data, number);
				} else {
					submodmap.set(data, 1);
				}
			});
			submodmap.delete(currentSubreddit);
			drawSubreddits();
			var processedMods = modnames.length - acc;
			drawSubreddit("processedMods " + processedMods + "/" + modnames.length, "subreddits " + submodmap.size);
		})
		.then(function() {
			processmoderatorsrecoursive(modnames, submodmap, acc - 1, runID);
		}, function() {
			alert("error trying to read a redditors profile");
			processmoderatorsrecoursive(modnames, submodmap, acc - 1, runID);
		});
	}
	else
	{
		drawSubreddits();
		drawCurrentSubreddit();
		
		var sortedsubs = [];
		for (var [key, value] of submodmap.entries()) {
			if(value > 1){
				sortedsubs.push([key, value])
			}
		};
		sortedsubs.sort(function(a, b) {
			return b[1] - a[1];
		});
		// Create buttons to save image and expand raw data
		$("#saveimage").html("<button id='saveimagebutton' onclick='saveImage()'>Save image</button>");
		$("#showraw").html("<button id='showrawbutton' onclick='expandRawData()'>Show raw data</button>");
		for(var l = 0; l < sortedsubs.length; l++){
			$("#rawresults").append('<p>' + sortedsubs[l][0] + ": " + sortedsubs[l][1] + '</p>');
		}
	}
}

function drawSubreddits(){
	var angle = 0;
	var deltaAngle = 2 * Math.PI / drawnsubreddits.length;
	
	clearCanvas();
	for(var j = drawnsubreddits.length - 1; j >= 0; j--){
		var dx = Math.sin(angle) * 250;
		var dy = Math.cos(angle) * 250;
		
		var subSize = drawnsubreddits[j][1];
		drawRelatedSubreddit(drawnsubreddits[j][0], drawnsubreddits[j][1], drawnsubreddits[j][2], dx, dy);
		angle = angle + deltaAngle;
	}
}

var drawnsubreddits = Array();
function updateDrawnSubreddits(subreddit, number) {
	for(i = 0; i < drawnsubreddits.length; i++){
		if(drawnsubreddits[i][0] == subreddit){
			drawnsubreddits[i][1] = number;
			sortDrawnSubreddits();
			return;
		}
	}
	if(drawnsubreddits.length < 10){
		drawnsubreddits.push([subreddit, number, random(256)]);
		sortDrawnSubreddits();
	}
	else
	{
		var min = drawnsubreddits[0][1];
		if(number > min){
			drawnsubreddits[0] = [subreddit, number, random(256)];
			sortDrawnSubreddits();
		}
	}
}

function sortDrawnSubreddits(){
	drawnsubreddits.sort(function(a, b) {
		return a[1] - b[1];
	});
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

function drawCurrentSubreddit(){
	drawSubreddit(currentSubreddit, currentSubredditSize);
}

function drawRelatedSubreddit(name, size, color, deltaX, deltaY){
	var relSize = size / currentSubredditSize;
	var px = 360 + deltaX;
	var py = 360 + deltaY;
	
	stroke(color, 45, 95);
	strokeWeight(100 * relSize);
	line(360,360, px, py);
	noStroke();
	
	fill(color, 80, 90);
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