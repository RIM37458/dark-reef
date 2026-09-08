# Implementation Plan

1. Establish the configuration and status contracts with failing tests.
2. Add the friend-spectate monitor and explicit ordinary-pub fallback states.
3. Add the allowlisted Valve realtime-stats adapter and localhost HTTP API.
4. Wire the dotakit login lifecycle, document setup, and run security/build checks.

The riskiest boundary is the undocumented/variable availability of realtime stats for ordinary public matches. The monitor therefore treats a returned server id as useful success and detailed stats as an optional enrichment.
