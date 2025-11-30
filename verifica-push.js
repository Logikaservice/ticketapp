// Script Node.js per verificare lo stato Git
const { execSync } = require('child_process');
const fs = require('fs');

console.log('=== VERIFICA STATO GIT ===\n');

try {
    // Stato
    console.log('📊 STATUS:');
    const status = execSync('git status --short', { encoding: 'utf8', cwd: 'c:\\TicketApp' });
    console.log(status || 'Nessuna modifica');

    // Ultimo commit locale
    console.log('\n📝 ULTIMO COMMIT LOCALE:');
    const lastCommit = execSync('git log --oneline -1', { encoding: 'utf8', cwd: 'c:\\TicketApp' });
    console.log(lastCommit || 'Nessun commit');

    // Commit da pushare
    console.log('\n🚀 COMMIT DA PUSHARE:');
    try {
        const toPush = execSync('git log origin/main..HEAD --oneline', { encoding: 'utf8', cwd: 'c:\\TicketApp' });
        console.log(toPush || '✅ Nessun commit da pushare - tutto sincronizzato!');
    } catch (e) {
        console.log('⚠️ Errore nel verificare commit da pushare:', e.message);
    }

    // Remote
    console.log('\n🌐 REMOTE:');
    const remote = execSync('git remote -v', { encoding: 'utf8', cwd: 'c:\\TicketApp' });
    console.log(remote);

} catch (error) {
    console.error('❌ Errore:', error.message);
}

