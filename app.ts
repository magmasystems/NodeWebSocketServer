import * as WebSocket from 'ws';
import { LFService, Logger, LoggerFactory, LoggerFactoryOptions, LogGroupRule, LogLevel } from "typescript-logging";
import express = require('express');
import bodyParser = require('body-parser');

interface IWebSocketOnMessage { data: WebSocket.Data; type: string; target: WebSocket; }
interface IWebSocketOnClose { wasClean: boolean; code: number; reason: string; target: WebSocket; }
interface IWebSocketOnError { error: any; message: string; type: string; target: WebSocket; }

export class Program {
    private websocket: WebSocket.Server;
    private logger: Logger;
    private wsData: number = 0;

    // ExpressJS-related stuff
    private express: any;
    private router: express.Router;
    private wsTimer: NodeJS.Timeout;

    constructor(_args: string[]) {
        this.logger = this.createLogger('simple-ws-server', []);
        this.initWebServer();
        this.initTimer();
    }

    private createLogger(_name: string, _params?: []): Logger {
        const options = new LoggerFactoryOptions();
        options.addLogGroupRule(new LogGroupRule(new RegExp("app" + ".+"), LogLevel.Info));
        const factory = LFService.createNamedLoggerFactory("app", options);
        return factory.getLogger("app.default");
    }

    private initWebServer() {
        this.express = express();
        this.router = express.Router();

        // Add some middleware to support CORS requests
        this.express
            .use((_req, resp, next) => {
                resp.header("Access-Control-Allow-Origin", "*");
                resp.header("Access-Control-Allow-Methods", "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS");
                resp.header("Access-Control-Allow-Headers", "Access-Control-Allow-Origin, Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
                next();
            });

        this.express
            .use(bodyParser.json())                             // support json encoded bodies
            .use(bodyParser.urlencoded({ extended: true }))     // support encoded bodies
            .use(`/testws`, this.router);

        this.router.get('/', (req, resp) => {
            resp.status(200).json({ message: "Hello!" });
        });
    }

    private initTimer() {
        const interval = 1 * 1000;

        this.wsTimer = setInterval((...args) => {
            if (this.websocket) {
                const data = JSON.stringify({ symbol: 'MSFT', price: this.wsData++ });
                this.websocket.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(data);
                    }
                });
            }
        }, interval);
    }

    private initWebSocketWS(httpServer: any): void {
        if (this.websocket) {
            return;
        }

        // ws://localhost:3000/testws/quotes
        this.websocket = new WebSocket.Server({ server: httpServer, path: '/testws/quotes' });
        this.websocket.on('connection', (socket) => {
            this.logger.info('A client connected through the socket');
            socket.on('message', (event: WebSocket.Data) => {
                this.logger.info('A client sent a message to the socket:');
                this.logger.info(`[${event.toString()}]`);
            });
            socket.on('close', (_event: IWebSocketOnClose) => {
                this.logger.info('A client disconnected from the socket');
            });
            socket.on('error', (event: IWebSocketOnError) => {
                this.logger.error(`WebSocket error: ${event.message}`);
            });

            // Here we can put in event handlers for messages that the clients send us...
        });
    }

    public messageLoop(): void {
        const http = require('http').Server(this.express);
        const port = 3000;

        const httpServer = http.listen(port, () => {
            this.logger.info(`TestWS listening on port ${port}!`);
        });

        // this.initWebSocket(http);
        this.initWebSocketWS(httpServer);
    }
}

const program = new Program(process.argv);
program.messageLoop();
