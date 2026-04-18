const https = require('https');

const options = {
  hostname: 'api.github.com',
  path: '/repos/Logikaservice/ticketapp/actions/runs?per_page=1',
  headers: {
    'User-Agent': 'node.js',
    'Accept': 'application/vnd.github.v3+json'
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const runs = JSON.parse(data);
    console.log(`Status: ${runs.workflow_runs[0].status}`);
    console.log(`Conclusion: ${runs.workflow_runs[0].conclusion}`);
    console.log(`HTML URL: ${runs.workflow_runs[0].html_url}`);
  });
}).on('error', (err) => console.error(err));
