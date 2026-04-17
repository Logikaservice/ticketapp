## L-Sight RTC (Agent) — worker .NET

Questa cartella contiene il **worker** che gestisce il signaling WebRTC lato PC (agent) e risponde con `answer`/`ice`.

### Requisiti

- Windows 10/11
- **.NET SDK 8.x** installato sul PC di build

### Build

Da PowerShell:

```powershell
cd C:\TicketApp\agent\LsightRtc\LogikaRtcWorker
dotnet restore
dotnet publish -c Release -r win-x64 --self-contained false -o ..\..\CommAgent\bin\rtc-worker
```

### Esecuzione (manuale)

```powershell
.\LogikaRtcWorker.exe --serverUrl "https://ticket.logikaservice.it" --agentKey "<API_KEY>" --pollSeconds 2
```

### Note

- In questa prima milestone il worker crea una peer WebRTC e risponde con **`answer` + ICE**.
- La cattura schermo/video verrà aggiunta nello step successivo (track video).

