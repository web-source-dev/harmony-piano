/**
 * PM2 deployment for Harmony Piano
 *
 *   pm2 start ecosystem.config.js
 *
 * harmony-app  = Node server: static files + real-time relay (/relay) + chat
 *                logs, all on port 8550. The relay is same-origin, so the
 *                browser always reaches it and the fun features sync in real
 *                time. THE APP MUST BE SERVED FROM THIS (not a plain static
 *                host) for moving/clicking/size to sync.
 * harmony-media = Python media-server.py on 8551 for Room DJ uploads.
 *
 * Commands:
 *   pm2 logs harmony-app
 *   pm2 restart harmony-app
 *   pm2 save && pm2 startup   (keep running after reboot)
 */
module.exports = {
	apps: [
		{
			// app + real-time relay + chat logging, one origin
			name: "harmony-app",
			script: "relay-server.js",
			args: "8550",
			interpreter: "node",
			cwd: __dirname,
			watch: false,
			autorestart: true,
			max_restarts: 10,
			env: {
				NODE_ENV: "production"
			}
		},
		{
			name: "harmony-media",
			script: "media-server.py",
			args: "8551",
			interpreter: "python3",
			cwd: __dirname,
			watch: false,
			autorestart: true,
			max_restarts: 10,
			env: {
				NODE_ENV: "production"
			}
		}
	]
};
