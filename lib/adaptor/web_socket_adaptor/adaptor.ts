import { Adaptor, AdaptorConfig } from "../../core/mod.ts";
import { WebSocketEndpointInput } from "./endpoint_input.ts";
import { Router } from "../../core/router.ts";
import { EnlaceServer } from "../../core/server.ts";
import Log from "../../util/log.ts";
import { acceptWebSocket } from "https://deno.land/std/ws/mod.ts";
import { HttpAdaptor } from "../http_adaptor/adaptor.ts";
import { attachWebSocket } from "./attach_middle_ware.ts";
import { rgb24, bold } from "https://deno.land/std/fmt/colors.ts";
import { path_to_url } from "../../util/path_to_url.ts";
import { Client } from "../../client.ts";
import { injectable } from "../../decorators/injectable.ts";

@injectable
export class WebSocketAdaptor extends Adaptor {

  static readonly protocol: string = "WebSocket";
  public router: Router = new Router(this);
  private encoder: TextEncoder = new TextEncoder();

  constructor(
    protected readonly httpAdaptor: HttpAdaptor
  ) {
    super();
  }

  public attachOnServer(server: EnlaceServer, configure: AdaptorConfig) {
    super.attachOnServer(server, configure);
    Log.info(`listen on ${rgb24(bold(`ws://${configure.host}:${configure.port}/`), 0xb7b1ff)}`, "WebSocket");
    this.httpAdaptor.router.useMiddlewareOn("*", attachWebSocket(async (input) => {
      const { conn, r: bufReader, w: bufWriter, headers } = input.meta;
      try {
        const sock = await acceptWebSocket({
          conn, bufReader, bufWriter, headers,
        });
        try {
          for await (const event of sock) {
            const url = path_to_url(input.meta.proto, input.meta.headers, input.meta.url);
            const inputContent = new WebSocketEndpointInput(url.pathname, sock, event);
            this.clientToInput.set(inputContent.client, inputContent);
            this.didReceiveContent(inputContent, inputContent.client);
          }
        } catch (err) {
          Log.error(`failed to receive frame: ${err}`);
          if (!sock.isClosed) {
            await sock.close(1000).catch(Log.error);
          }
        }
      } catch (err) {
        Log.error(`failed to accept websocket: ${err}`);
        await input.meta.respond({ status: 400 });
      }
    }));
  }

  public sendToClient(client: Client, content: any) {
    const input = this.clientToInput.get(client);
    if (input && input instanceof WebSocketEndpointInput) {
      const responseUnit8Array = this.encoder.encode(content);
      input.meta.send(responseUnit8Array).then(() => {
        // todo send done
      });
    } else {
      // todo throw error here
    }
  }

}