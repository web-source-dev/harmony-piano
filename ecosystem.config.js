/**
 * PM2 deployment for Harmony Piano
 *
 * USE THIS (chat logging + static files):
 *   pm2 start ecosystem.config.js
 *
 * Plain static only (NO chat save):
 *   pm2 start ecosystem.config.js --only piano-static
 *
 * Commands:
 *   pm2 logs harmony-piano
 *   pm2 restart harmony-piano
 *   pm2 stop harmony-piano
 *   pm2 save && pm2 startup   (keep running after reboot)
 */
module.exports = {
	apps: [
		{
			name: "harmony-piano",
			script: "chat-save-server.py",
			args: "8550",
			interpreter: "python",
			cwd: __dirname,
			watch: false,
			autorestart: true,
			max_restarts: 10,
			env: {
				NODE_ENV: "production"
			}
		},
		{
			name: "piano-static",
			script: "python",
			args: "-m http.server 8550",
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
