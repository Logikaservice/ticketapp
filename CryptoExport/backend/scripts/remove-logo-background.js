const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function removeBlackBackground() {
    const inputPath = path.join(__dirname, '../../frontend/public/logo-logika.png');
    const outputPath = path.join(__dirname, '../../frontend/public/logo-logika-transparent.png');
    
    console.log('🎨 Rimozione sfondo nero dal logo...');
    console.log(`📁 Input: ${inputPath}`);
    console.log(`📁 Output: ${outputPath}`);
    
    try {
        // Leggi l'immagine
        const image = sharp(inputPath);
        const metadata = await image.metadata();
        
        console.log(`📊 Dimensioni originali: ${metadata.width}x${metadata.height}`);
        console.log(`📊 Formato: ${metadata.format}`);
        
        // Rimuovi lo sfondo nero convertendo i pixel neri in trasparenti
        // Usiamo una soglia per catturare anche neri leggermente diversi
        const { data, info } = await image
            .ensureAlpha() // Assicura canale alpha
            .raw()
            .toBuffer({ resolveWithObject: true });
        
        // Processa ogni pixel
        const threshold = 30; // Soglia per considerare un pixel "nero" (0-255)
        const newData = Buffer.alloc(data.length);
        
        for (let i = 0; i < data.length; i += info.channels) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = info.channels === 4 ? data[i + 3] : 255;
            
            // Se il pixel è nero o molto scuro, rendilo trasparente
            // Altrimenti mantieni il colore originale
            if (r <= threshold && g <= threshold && b <= threshold) {
                // Pixel nero -> trasparente
                newData[i] = r;
                newData[i + 1] = g;
                newData[i + 2] = b;
                newData[i + 3] = 0; // Alpha = 0 (trasparente)
            } else {
                // Mantieni il pixel originale
                newData[i] = r;
                newData[i + 1] = g;
                newData[i + 2] = b;
                newData[i + 3] = a;
            }
        }
        
        // Crea la nuova immagine con trasparenza
        await sharp(newData, {
            raw: {
                width: info.width,
                height: info.height,
                channels: 4
            }
        })
        .png({
            quality: 100,
            compressionLevel: 6, // Bilanciamento qualità/dimensione
            adaptiveFiltering: true,
            palette: false // Mantieni tutti i colori
        })
        .toFile(outputPath);
        
        console.log('✅ Logo con sfondo trasparente creato con successo!');
        console.log(`📁 File salvato in: ${outputPath}`);
        
        // Mostra le dimensioni dei file
        const inputStats = fs.statSync(inputPath);
        const outputStats = fs.statSync(outputPath);
        console.log(`\n📊 Dimensioni file:`);
        console.log(`   Originale: ${(inputStats.size / 1024).toFixed(2)} KB`);
        console.log(`   Nuovo: ${(outputStats.size / 1024).toFixed(2)} KB`);
        
    } catch (error) {
        console.error('❌ Errore durante la rimozione dello sfondo:', error);
        process.exit(1);
    }
}

removeBlackBackground();

