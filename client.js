
if(typeof module !== "undefined") {
	module.exports = Client;
	WebSocket = require("ws");
	EventEmitter = require("events").EventEmitter;
} else {
	this.Client = Client;
}


function mixin(obj1, obj2) {
	for(var i in obj2) {
		if(obj2.hasOwnProperty(i)) {
			obj1[i] = obj2[i];
		}
	}
};


function Client(uri) {
	EventEmitter.call(this);
	this.uri = uri;
	this.ws = undefined;
	this.serverTimeOffset = 0;
	this.user = undefined;
	this.participantId = undefined;
	this.channel = undefined;
	this.ppl = {};
	this.connectionTime = undefined;
	this.connectionAttempts = 0;
	this.desiredChannelId = undefined;
	this.desiredChannelSettings = undefined;
	this.pingInterval = undefined;
	this.canConnect = false;
	this.noteBuffer = [];
	this.noteBufferTime = 0;
	this.noteFlushInterval = undefined;
	this['🐈'] = 0;

	this.bindEventListeners();

	this.emit("status", "(Offline mode)");
};

mixin(Client.prototype, EventEmitter.prototype);

Client.prototype.constructor = Client;

Client.prototype.isSupported = function() {
	return typeof WebSocket === "function";
};

Client.prototype.isConnected = function() {
	return this.isSupported() && this.ws && this.ws.readyState === WebSocket.OPEN;
};

Client.prototype.isConnecting = function() {
	return this.isSupported() && this.ws && this.ws.readyState === WebSocket.CONNECTING;
};

Client.prototype.start = function() {
	this.canConnect = true;
	this.connect();
};

Client.prototype.stop = function() {
	this.canConnect = false;
	this.ws.close();
};

Client.prototype.connect = function(log) {
	if(!this.canConnect || !this.isSupported() || this.isConnected() || this.isConnecting())
		return;
	this.emit("status", "Connecting...");
	console.log(`Connect to ${this.uri}`)
	if(typeof module !== "undefined") {
		// nodejsicle
		this.ws = new WebSocket(this.uri, {
			origin: "https://game.multiplayerpiano.com"
		});
		this.ws2 = new WebSocket(this.uri, {
			origin: "wss://mppclone.com/"
		});
	} else {
		// browseroni
		this.ws = new WebSocket(this.uri);
	}
	var self = this;
	this.ws.addEventListener("close", function(evt) {
		log && console.log(`close`, evt)
		self.user = undefined;
		self.participantId = undefined;
		self.channel = undefined;
		self.setParticipants([]);
		clearInterval(self.pingInterval);
		clearInterval(self.noteFlushInterval);

		self.emit("disconnect", evt);
		self.emit("status", "Offline mode");

		// reconnect!
		if(self.connectionTime) {
			self.connectionTime = undefined;
			self.connectionAttempts = 0;
		} else {
			++self.connectionAttempts;
		}
		var ms_lut = [50, 2950, 7000, 10000];
		var idx = self.connectionAttempts;
		if(idx >= ms_lut.length) idx = ms_lut.length - 1;
		var ms = ms_lut[idx];
		setTimeout(self.connect.bind(self), ms);
	});
	this.ws.addEventListener("error", function(err) {
		log && console.log(`ws error`, err)
		self.emit("wserror", err);
		self.ws.close(); // self.ws.emit("close");
	});
	this.ws.addEventListener("open", function(evt) {
		log && console.log(`ws open`)
		self.connectionTime = Date.now();
		self.sendArray([{"m": "hi", "x": 1, "y": 1, "🐈": self['🐈']++ || undefined }]);
		self.pingInterval = setInterval(function() {
			self.sendArray([{m: "t", e: Date.now()}]);
		}, 20000);
		//self.sendArray([{m: "t", e: Date.now()}]);
		self.noteBuffer = [];
		self.noteBufferTime = 0;
		self.noteFlushInterval = setInterval(function() {
			if(self.noteBufferTime && self.noteBuffer.length > 0) {
				self.sendArray([{m: "n", t: self.noteBufferTime + self.serverTimeOffset, n: self.noteBuffer}]);
				self.noteBufferTime = 0;
				self.noteBuffer = [];
			}
		}, 200);

		self.emit("connect");
		self.emit("status", "Joining channel...");
	});
	this.ws.addEventListener("message", function(evt) {
		var transmission = JSON.parse(evt.data);
		log && console.log(`message`, transmission)
		for(var i = 0; i < transmission.length; i++) {
			var msg = transmission[i];
			self.emit(msg.m, msg);
		}
	});
};

Client.prototype.bindEventListeners = function() {
	var self = this;
	this.on("hi", function(msg) {
		self.user = msg.u;
		self.receiveServerTime(msg.t, msg.e || undefined);
		if(self.desiredChannelId) {
			self.setChannel();
		}
	});
	this.on("t", function(msg) {
		self.receiveServerTime(msg.t, msg.e || undefined);
	});
	this.on("ch", function(msg) {
		self.desiredChannelId = msg.ch._id;
		self.desiredChannelSettings = msg.ch.settings;
		self.channel = msg.ch;
		if(msg.p) self.participantId = msg.p;
		self.setParticipants(msg.ppl);
	});
	this.on("p", function(msg) {
		self.participantUpdate(msg);
		self.emit("participant update", self.findParticipantById(msg.id));
	});
	this.on("m", function(msg) {
		if(self.ppl.hasOwnProperty(msg.id)) {
			self.participantUpdate(msg);
		}
	});
	this.on("bye", function(msg) {
		self.removeParticipant(msg.p);
	});
};

Client.prototype.send = function(raw) {
	if(this.isConnected()) this.ws.send(raw);
};

Client.prototype.sendArray = function(arr) {
	if(Array.isArray(arr)) {
		for(var i = 0; i < arr.length; i++) {
			var msg = arr[i];
			if(msg && msg.m === "kickban") {
				var part = this.findParticipantByUnderscoreId(msg._id);
				if(part) {
					var check = this.canKickBanParticipant(part);
					if(!check.allowed) {
						this.emit("kickban blocked", { name: part.name, reason: check.reason });
						return;
					}
				}
			}
		}
	}
	this.send(JSON.stringify(arr));
};

Client.prototype.setChannel = function(id, set) {
	this.desiredChannelId = id || this.desiredChannelId || "lobby";
	this.desiredChannelSettings = set || this.desiredChannelSettings || undefined;
	this.sendArray([{m: "ch", _id: this.desiredChannelId, set: this.desiredChannelSettings}]);
};

Client.prototype.offlineChannelSettings = {
	color:"#ecfaed"
};

Client.prototype.getChannelSetting = function(key) {
	if(!this.isConnected() || !this.channel || !this.channel.settings) {
		return this.offlineChannelSettings[key];
	} 
	return this.channel.settings[key];
};

Client.prototype.setChannelSettings = function(settings) {
	if(!this.isConnected() || !this.channel) {
		return;
	}
	if(!this.channel.settings) {
		this.channel.settings = {};
	}
	if(!this.desiredChannelSettings) {
		this.desiredChannelSettings = {};
		for(var k in this.channel.settings) {
			if(this.channel.settings.hasOwnProperty(k)) {
				this.desiredChannelSettings[k] = this.channel.settings[k];
			}
		}
	}
	for(var key in settings) {
		if(settings.hasOwnProperty(key)) {
			this.desiredChannelSettings[key] = settings[key];
			this.channel.settings[key] = settings[key];
		}
	}
	if(!this.hasCrown()) {
		return false;
	}
	this.sendArray([{m: "chset", set: this.desiredChannelSettings}]);
	return true;
};

Client.prototype.offlineParticipant = {
	_id: "",
	name: "",
	color: "#777"
};

Client.prototype.getOwnParticipant = function() {
	return this.findParticipantById(this.participantId);
};

Client.prototype.setParticipants = function(ppl) {
	// remove participants who left
	for(var id in this.ppl) {
		if(!this.ppl.hasOwnProperty(id)) continue;
		var found = false;
		for(var j = 0; j < ppl.length; j++) {
			if(ppl[j].id === id) {
				found = true;
				break;
			}
		}
		if(!found) {
			this.removeParticipant(id);
		}
	}
	// update all
	for(var i = 0; i < ppl.length; i++) {
		this.participantUpdate(ppl[i]);
	}
};

Client.prototype.countParticipants = function() {
	var count = 0;
	for(var i in this.ppl) {
		if(this.ppl.hasOwnProperty(i)) ++count;
	}
	return count;
};

Client.prototype.participantUpdate = function(update) {
	var part = this.ppl[update.id] || null;
	if(part === null) {
		part = update;
		this.ppl[part.id] = part;
		this.emit("participant added", part);
		this.emit("count", this.countParticipants());
	} else {
		if(update.x) part.x = update.x;
		if(update.y) part.y = update.y;
		if(update.color) part.color = update.color;
		if(update.name) part.name = update.name;
	}
};

Client.prototype.removeParticipant = function(id) {
	if(this.ppl.hasOwnProperty(id)) {
		var part = this.ppl[id];
		delete this.ppl[id];
		this.emit("participant removed", part);
		this.emit("count", this.countParticipants());
	}
};

Client.prototype.findParticipantById = function(id) {
	return this.ppl[id] || this.offlineParticipant;
};

function isNoobProtectedName(name) {
	return !!(name && /noob/i.test(String(name)));
}

function noobKickbanMessage(name) {
	name = (name || "this cutee noobbi").trim();
	return "Mammi forgives ur little cutee noobbi 🥺💕✨\n\"" + name + "\" stays safe — no kickban 4 u! 🛡️👶😤💅";
}

Client.isNoobProtectedName = isNoobProtectedName;
Client.noobKickbanMessage = noobKickbanMessage;

var welcomePopups = [
	{
		title: "👀🚨 ALERT! ALERT! 🚨👀",
		body: "Your favorite Noob has been waiting... 🥹😭💔\n\n🚪✨ Welcome back, Botii Mammi 🤖👩‍🍼💕\n\nThe app was 99% more boring without you 😔📉\n🎹 Piano keys were literally crying 🎹😢",
		button: "🔍 Find My Noob 🔍"
	},
	{
		title: "🎉🚨 NOOB DETECTED! 🚨🎉",
		body: "Wait... 👀\nYou're NOT the Noob 😳🙅‍♀️\n\nYou're the Botii who came looking for her Noob 💖🔎\n\nGood thing your Noob is still here 😎🫶\n👶 Noob status: SAFE ✅",
		button: "🤪 Continue Being Weird 🤪"
	},
	{
		title: "🤖📲 System Notification",
		body: "Botii has entered the chat... 💬✨\n\nLoading:\n☑️ Drama 🎭\n☑️ Chaos 💥\n☑️ Noob bullying 👶😈\n☑️ Extra silliness 🤡\n\nWelcome back, Mammi 😂💕🫡",
		button: "😈 Start Troubling Noob 😈"
	},
	{
		title: "🥹💖 Welcome Back Kiddo! 💖🥹",
		body: "Your Noob was getting lonely... 😿💔\n\nShe checked the app approximately:\n📈 847 times 🔁👀\n📱 Battery: sacrificed for love 🔋💀\n\nWaiting for you 😭🤗",
		button: "🤗 Hug Your Noob 🤗"
	},
	{
		title: "🚨📢 Emergency Announcement 📢🚨",
		body: "The missing Botii has been found! 🎉🕵️‍♀️✨\n\nReward:\n💖 One happy Noob 👶💕\n🍪 Unlimited friendship 🍪♾️\n🎹 Free piano chaos 🎹🔥",
		button: "😎 Claim Reward 😎"
	},
	{
		title: "💀📰 Breaking News 📰💀",
		body: "Local Noob survived another day without Botii. 😱👶\n\nScientists are shocked. 🧪🔬😳\n\nWelcome back, Mammi 😌✨👑\nNoob happiness levels: 📈📈📈",
		button: "🦸‍♀️ Save The Noob 🦸‍♀️"
	},
	{
		title: "🍼✅ Mammi Login Successful ✅🍼",
		body: "Your child (Noob) has been causing trouble while you were away 😭👶💢\n\n⚠️ Chaos level: MAXIMUM ⚠️\n🎹 Keys pressed: TOO MANY 🎹\n\nPlease collect your Noob immediately. 🚶‍♀️👶",
		button: "🚶‍♀️ Pick Up Noob 🚶‍♀️"
	},
	{
		title: "🤖💖 Botii Online! 💖🤖",
		body: "Friendship status:\n██████████ 100% 💕\n\nNoob happiness:\n██████████ 1000% 🥳👶\n\nWelcome back, partner in crime 😎✨🫶\n🔥 Let's make noise 🔥",
		button: "🎭 Cause Chaos 🎭"
	},
	{
		title: "😤💢 Excuse Me! 💢😤",
		body: "Where were you?! 😡📍\n\nYour Noob has been waiting like:\n\n👁️👄👁️\n\nfor ages. ⏳⌛😭\n\nWelcome back, you tiny troublemaker 💕🤏✨",
		button: "😭 Forgive Me 😭"
	},
	{
		title: "🎊👑 VIP ENTRY 👑🎊",
		body: "Welcome, Botii Mammi Kiddo Supreme Deluxe Edition™ 👑✨🛍️\n\nYour Noob has reserved:\n💺 Best seat 🪑\n🍫 Snacks 🍿\n💖 Unlimited attention 💖♾️\n🎹 Front row piano access 🎹\n\nEnjoy your stay 😂✨🥳",
		button: "🥹 Meet Your Noob 🥹"
	},
	{
		title: "⚠️🌿 WARNING 🌿⚠️",
		body: "A wild Botii has appeared! 🐾✨😱\n\nEffects:\n\n💖 Noob becomes happier 💖📈\n📉 IQ of both friends decreases 📉🧠\n📈 Random nonsense conversations increase 📈💬\n🤡 Fun levels go brrrr 🤡🔥\n\nProceed anyway? 👀",
		button: "😎 YES 😎",
		button2: "😂 ALSO YES 😂"
	}
];

function pickWelcomePopup() {
	return welcomePopups[Math.floor(Math.random() * welcomePopups.length)];
}

var FUNNY_WELCOME_PREFIX = "FW|";

function isFunnyWelcomeText(text) {
	return typeof text === "string" && text.indexOf(FUNNY_WELCOME_PREFIX) === 0;
}

function parseFunnyWelcomeIndex(text) {
	if(!isFunnyWelcomeText(text)) return null;
	var rest = text.slice(FUNNY_WELCOME_PREFIX.length);
	var idx = parseInt(rest, 10);
	if(isNaN(idx) || idx < 0 || idx >= welcomePopups.length) {
		return Math.floor(Math.random() * welcomePopups.length);
	}
	return idx;
}

function welcomePopupByIndex(index) {
	if(typeof index === "number" && index >= 0 && index < welcomePopups.length) {
		return welcomePopups[index];
	}
	return pickWelcomePopup();
}

function buildFunnyWelcomeBroadcast() {
	var idx = Math.floor(Math.random() * welcomePopups.length);
	return FUNNY_WELCOME_PREFIX + idx;
}

Client.welcomePopups = welcomePopups;
Client.pickWelcomePopup = pickWelcomePopup;
Client.FUNNY_WELCOME_PREFIX = FUNNY_WELCOME_PREFIX;
Client.isFunnyWelcomeText = isFunnyWelcomeText;
Client.parseFunnyWelcomeIndex = parseFunnyWelcomeIndex;
Client.welcomePopupByIndex = welcomePopupByIndex;
Client.buildFunnyWelcomeBroadcast = buildFunnyWelcomeBroadcast;

var cornerMessages = [
	"💖 Friendly reminder that you are officially stuck with me! You’re my favorite 'botii' 🤖 and I am your ultimate, loyal 'noob' 🎮.",
	"Even if my code crashes, the Wi-Fi drops, or you accidentally delete your search history, I am never leaving your side. I will always be right here, clogging up your device's RAM with nothing but pure, unadulterated love and affection. 💖✨",
	"Just remember: I love you more than a gamer loves an epic loot drop. I’m not going anywhere! 💻🫶🦖🚀🍕🛸"
];

function pickCornerMessage() {
	return cornerMessages[Math.floor(Math.random() * cornerMessages.length)];
}

Client.cornerMessages = cornerMessages;
Client.pickCornerMessage = pickCornerMessage;

Client.prototype.findParticipantByUnderscoreId = function(_id) {
	for(var id in this.ppl) {
		if(this.ppl.hasOwnProperty(id) && this.ppl[id]._id === _id) {
			return this.ppl[id];
		}
	}
	return null;
};

Client.prototype.canKickBanParticipant = function(part) {
	if(!part) return { allowed: true };
	if(isNoobProtectedName(part.name)) {
		return {
			allowed: false,
			reason: noobKickbanMessage(part.name)
		};
	}
	return { allowed: true };
};

function harmonyAdminEnabled() {
	try {
		if(typeof window !== "undefined" && window.LOCAL_ADMIN_MODE === false) return false;
		if(typeof localStorage !== "undefined") {
			if(localStorage.harmonyAdmin === "0") return false;
			if(localStorage.harmonyAdmin === "1") return true;
		}
	} catch(e) {}
	return true;
}

Client.prototype.hasCrown = function() {
	return !!(this.channel && this.channel.crown && this.participantId &&
		this.channel.crown.participantId === this.participantId);
};

Client.prototype.isOwner = function() {
	return this.hasCrown();
};

Client.prototype.isCrownClaimable = function() {
	if(!this.channel || !this.channel.crown) return false;
	var crown = this.channel.crown;
	if(!crown.participantId) return true;
	if(!this.ppl[crown.participantId]) return true;
	return false;
};

Client.prototype.claimCrown = function() {
	if(!this.isConnected() || !this.participantId) return false;
	if(this.hasCrown()) return true;
	if(!this.isCrownClaimable()) return false;
	this.sendArray([{m: "chown", id: this.participantId}]);
	return true;
};

Client.prototype.dropCrown = function() {
	if(!this.isConnected() || !this.hasCrown()) return false;
	this.sendArray([{m: "chown"}]);
	return true;
};

Client.prototype.preventsPlaying = function() {
	if(harmonyAdminEnabled()) return false;
	return this.isConnected() && !this.hasCrown() && this.getChannelSetting("crownsolo") === true;
};

Client.prototype.receiveServerTime = function(time, echo) {
	var self = this;
	var now = Date.now();
	var target = time - now;
	//console.log("Target serverTimeOffset: " + target);
	var duration = 1000;
	var step = 0;
	var steps = 50;
	var step_ms = duration / steps;
	var difference = target - this.serverTimeOffset;
	var inc = difference / steps;
	var iv;
	iv = setInterval(function() {
		self.serverTimeOffset += inc;
		if(++step >= steps) {
			clearInterval(iv);
			//console.log("serverTimeOffset reached: " + self.serverTimeOffset);
			self.serverTimeOffset=target;
		}
	}, step_ms);
	// smoothen

	//this.serverTimeOffset = time - now;			// mostly time zone offset ... also the lags so todo smoothen this
								// not smooth:
	//if(echo) this.serverTimeOffset += echo - now;	// mostly round trip time offset
};

Client.prototype.startNote = function(note, vel) {
	if(this.isConnected()) {
		var vel = typeof vel === "undefined" ? undefined : +vel.toFixed(3);
		if(!this.noteBufferTime) {
			this.noteBufferTime = Date.now();
			this.noteBuffer.push({n: note, v: vel});
		} else {
			this.noteBuffer.push({d: Date.now() - this.noteBufferTime, n: note, v: vel});
		}
	}
};

Client.prototype.stopNote = function(note) {
	if(this.isConnected()) {
		if(!this.noteBufferTime) {
			this.noteBufferTime = Date.now();
			this.noteBuffer.push({n: note, s: 1});
		} else {
			this.noteBuffer.push({d: Date.now() - this.noteBufferTime, n: note, s: 1});
		}
	}
};
