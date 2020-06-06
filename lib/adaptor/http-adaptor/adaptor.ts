import { serve } from "https://deno.land/std/http/server.ts";
import { Adaptor, AdaptorConfigure } from "../../core/adaptor.ts";
import { EnlaceServer } from "../../core/server.ts";
import { int } from "../../util/mod.ts";
import {
  HttpEndpointInput,
  HttpBody,
  HttpInputMeta,
  HttpSearchParameter,
} from "./endpoint-input.ts";
import { EndpointInput, Client } from "../../core/endpoint.ts";
import { pathToUrl } from "../../util/path-to-url.ts";
import { Router } from "../../core/router.ts";
import { Log } from "../../util/mod.ts";
import { rgb24, bold } from "https://deno.land/std/fmt/colors.ts";

export class HttpAdaptor extends Adaptor<HttpInputMeta, HttpBody> {
  readonly protocol: string = "Http";

  protected port!: int;
  protected host!: string;
  public server!: EnlaceServer;
  public router: Router = new Router(this);
  private encoder: TextEncoder = new TextEncoder();

  attachOnServer(
    server: EnlaceServer,
    configure: AdaptorConfigure,
  ): void {
    this.host = configure.host;
    this.port = configure.port;
    this.server = server;
    this.listenOnServer(this.host, this.port).then();
  }

  private async listenOnServer(host: string, port: int) {
    const s = serve({ port: port, hostname: host });
    Log.info(`listen on ${rgb24(bold(`http://${host}:${port}/`), 0xb7b1ff)}`, "Http");
    for await (const request of s) {
      const url = pathToUrl(request.proto, request.headers, request.url);
      const input = new HttpEndpointInput(url.pathname, request);
      const searchParameters: HttpSearchParameter = {};
      url.searchParams.forEach((value, key) => {
        searchParameters[key] = value;
      });
      input.parameters = searchParameters;
      this.clientToInput.set(input.client, input);
      this.didReceiveContent(input, input.client);
    }
  }
  
  public sendToClient(client: Client, content: any) {
    const input = this.clientToInput.get(client);
    if (input) {
      const responseUnit8Array = this.encoder.encode(content);
      input.meta.respond({ body: responseUnit8Array });
    }
  }
}
