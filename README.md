# icwe2023-evaluation

Data and tools to reproduce the evaluation made for the paper titled "A tiles-based approach for shortest path calculation over real networks on the web" submitted to ICWE2023

## Execution command

Performance evaluation (tile interface over Virtuoso):

```bash
cd client

node index.js --experiment performance --gs-type virtuoso --gs-address 10.2.32.149 --ti-type sparql --ti-address 10.2.32.138 --zoom 9 --iterations 1 --disable-client-cache --bypass-server-cache --timeout 120000
```
