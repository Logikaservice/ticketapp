using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using SIPSorcery.Net;

static string GetArg(string[] args, string name, string? defaultValue = null)
{
    var idx = Array.FindIndex(args, a => string.Equals(a, name, StringComparison.OrdinalIgnoreCase));
    if (idx < 0) return defaultValue ?? "";
    if (idx + 1 >= args.Length) return defaultValue ?? "";
    return args[idx + 1];
}

static int GetIntArg(string[] args, string name, int defaultValue)
{
    var s = GetArg(args, name, "");
    return int.TryParse(s, out var v) ? v : defaultValue;
}

var serverUrl = GetArg(args, "--serverUrl", "").Trim().TrimEnd('/');
var agentKey = GetArg(args, "--agentKey", "").Trim();
var pollSeconds = Math.Max(1, GetIntArg(args, "--pollSeconds", 2));

if (string.IsNullOrWhiteSpace(serverUrl) || string.IsNullOrWhiteSpace(agentKey))
{
    Console.Error.WriteLine("Uso: LogikaRtcWorker --serverUrl <https://...> --agentKey <key> [--pollSeconds 2]");
    return 2;
}

Console.WriteLine($"[rtc-worker] start serverUrl={serverUrl} pollSeconds={pollSeconds}");

var http = new HttpClient
{
    Timeout = TimeSpan.FromSeconds(10)
};
http.DefaultRequestHeaders.Add("X-Agent-Key", agentKey);
http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

long lastSignalId = 0;
int? activeSessionId = null;
RTCPeerConnection? pc = null;

static long GetJsonLong(JsonElement el)
{
    if (el.ValueKind == JsonValueKind.Number)
    {
        if (el.TryGetInt64(out var v)) return v;
        if (el.TryGetInt32(out var i)) return i;
    }
    if (el.ValueKind == JsonValueKind.String)
    {
        var s = el.GetString();
        if (!string.IsNullOrWhiteSpace(s) && long.TryParse(s, out var v)) return v;
    }
    return 0;
}

static int GetJsonInt(JsonElement el)
{
    if (el.ValueKind == JsonValueKind.Number)
    {
        if (el.TryGetInt32(out var v)) return v;
        if (el.TryGetInt64(out var l)) return (int)l;
    }
    if (el.ValueKind == JsonValueKind.String)
    {
        var s = el.GetString();
        if (!string.IsNullOrWhiteSpace(s) && int.TryParse(s, out var v)) return v;
    }
    return 0;
}

async Task<JsonDocument?> GetJson(string url)
{
    using var res = await http.GetAsync(url);
    var body = await res.Content.ReadAsStringAsync();
    if (!res.IsSuccessStatusCode)
    {
        Console.Error.WriteLine($"[rtc-worker] GET {url} -> {(int)res.StatusCode} {res.ReasonPhrase} body={body}");
        return null;
    }
    return JsonDocument.Parse(body);
}

async Task<bool> PostJson(string url, object payload)
{
    var json = JsonSerializer.Serialize(payload);
    using var res = await http.PostAsync(url, new StringContent(json, Encoding.UTF8, "application/json"));
    var body = await res.Content.ReadAsStringAsync();
    if (!res.IsSuccessStatusCode)
    {
        Console.Error.WriteLine($"[rtc-worker] POST {url} -> {(int)res.StatusCode} {res.ReasonPhrase} body={body}");
        return false;
    }
    return true;
}

async Task SendAgentSignal(int sessionId, string type, object payload)
{
    var url = $"{serverUrl}/api/lsight-rtc/agent/sessions/{sessionId}/signal";
    await PostJson(url, new { type, payload });
}

void EnsurePc(int sessionId)
{
    if (pc != null) return;

    var config = new RTCConfiguration
    {
        iceServers = new List<RTCIceServer>
        {
            // STUN only (prima milestone). TURN verrà aggiunto lato backend e qui consumato.
            new RTCIceServer { urls = "stun:stun.l.google.com:19302" }
        }
    };
    pc = new RTCPeerConnection(config);

    pc.onicecandidate += async (cand) =>
    {
        if (cand == null) return;
        await SendAgentSignal(sessionId, "ice", cand.toJSON());
    };

    pc.onconnectionstatechange += (state) =>
    {
        Console.WriteLine($"[rtc-worker] pc connectionState={state}");
    };

    // DataChannel (utile per heartbeat/controllo in futuro)
    pc.createDataChannel("control");
}

async Task HandleViewerOffer(int sessionId, JsonElement payload)
{
    EnsurePc(sessionId);
    if (pc == null) return;

    var sdp = payload.GetProperty("sdp").GetString() ?? "";
    var type = payload.GetProperty("type").GetString() ?? "offer";
    var desc = new RTCSessionDescriptionInit
    {
        sdp = sdp,
        type = RTCSdpType.offer
    };

    var setRes = pc.setRemoteDescription(desc);
    if (setRes != SetDescriptionResultEnum.OK)
    {
        Console.Error.WriteLine($"[rtc-worker] setRemoteDescription failed: {setRes}");
        return;
    }

    var answer = pc.createAnswer(null);
    try
    {
        await pc.setLocalDescription(answer);
    }
    catch (Exception e)
    {
        Console.Error.WriteLine($"[rtc-worker] setLocalDescription error: {e.Message}");
        return;
    }

    // Invia answer
    await SendAgentSignal(sessionId, "answer", new { type = "answer", sdp = answer.sdp });
    Console.WriteLine("[rtc-worker] answer sent");
}

Task HandleViewerIce(int sessionId, JsonElement payload)
{
    if (pc == null) return Task.CompletedTask;
    try
    {
        var cand = new RTCIceCandidateInit
        {
            candidate = payload.GetProperty("candidate").GetString(),
            sdpMid = payload.TryGetProperty("sdpMid", out var mid) ? mid.GetString() : null,
            sdpMLineIndex = payload.TryGetProperty("sdpMLineIndex", out var mli) ? (ushort)mli.GetInt32() : (ushort)0
        };
        pc.addIceCandidate(cand);
    }
    catch (Exception e)
    {
        Console.Error.WriteLine($"[rtc-worker] addIceCandidate error: {e.Message}");
    }
    return Task.CompletedTask;
}

while (true)
{
    try
    {
        // 1) sessioni attive per questo agent
        var list = await GetJson($"{serverUrl}/api/lsight-rtc/agent/sessions?limit=1");
        if (list == null) { await Task.Delay(TimeSpan.FromSeconds(pollSeconds)); continue; }
        var sessionsEl = list.RootElement.GetProperty("sessions");
        if (sessionsEl.GetArrayLength() == 0)
        {
            activeSessionId = null;
            lastSignalId = 0;
            await Task.Delay(TimeSpan.FromSeconds(pollSeconds));
            continue;
        }

        var sid = GetJsonInt(sessionsEl[0].GetProperty("id"));
        if (activeSessionId != sid)
        {
            activeSessionId = sid;
            lastSignalId = 0;
            try { pc?.close(); } catch { /* ignore */ }
            pc = null;
            Console.WriteLine($"[rtc-worker] activeSession={sid}");
            await SendAgentSignal(sid, "agent-ready", new { machine = Environment.MachineName, ts = DateTimeOffset.UtcNow.ToString("o") });
        }

        // 2) leggi segnali viewer (offer/ice)
        var sig = await GetJson($"{serverUrl}/api/lsight-rtc/agent/sessions/{sid}/signals?after={lastSignalId}&limit=50");
        if (sig == null) { await Task.Delay(TimeSpan.FromSeconds(pollSeconds)); continue; }

        var arr = sig.RootElement.GetProperty("signals");
        foreach (var s in arr.EnumerateArray())
        {
            var id = GetJsonLong(s.GetProperty("id"));
            if (id > lastSignalId) lastSignalId = id;
            var type = s.GetProperty("type").GetString() ?? "";
            var payload = s.GetProperty("payload");

            if (type == "offer")
                await HandleViewerOffer(sid, payload);
            else if (type == "ice")
                await HandleViewerIce(sid, payload);
        }
    }
    catch (Exception e)
    {
        Console.Error.WriteLine($"[rtc-worker] loop error: {e.Message}");
    }

    await Task.Delay(TimeSpan.FromSeconds(pollSeconds));
}

