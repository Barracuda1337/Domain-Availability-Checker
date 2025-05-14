import { NextResponse } from 'next/server';
import whois from 'whois';
import { WHOIS_SERVERS } from '@/lib/whois-servers';
import { promisify } from 'util';
import { sleep } from '@/lib/utils';
import { updateProgress } from '../whois-progress/route';

interface ParsedWhoisData {
  registrar?: string;
  creationDate?: string;
  expirationDate?: string;
  status?: string;
  nameServers?: string[];
  isAvailable?: boolean;
  isRateLimited?: boolean;
  rawData?: string;
}

function isDomainAvailable(data: string): boolean {
  const lowerData = data.toLowerCase();
  
  // Domain müsait değilse gösterilecek yaygın ifadeler
  const unavailablePatterns = [
    'no match for domain',
    'not found',
    'no data found',
    'status: free',
    'status: available',
    'domain not found',
    'no information available',
    'no match',
    'not registered',
    'no such domain',
    'domain name not known',
    'domain is not registered',
    'domain is available',
    'domain is free',
    'domain is not taken',
    'domain is not reserved',
    'domain is not assigned',
    'domain is not allocated',
    'domain is not active',
    'domain is not in use',
    'domain is not owned',
    'domain is not claimed',
    'domain is not taken',
    'domain is not reserved',
    'domain is not assigned',
    'domain is not allocated',
    'domain is not active',
    'domain is not in use',
    'domain is not owned',
    'domain is not claimed'
  ];

  // Bu ifadelerden herhangi biri varsa domain müsait demektir
  const isAvailable = unavailablePatterns.some(pattern => lowerData.includes(pattern));

  // Eğer domain müsait değilse ve aşağıdaki bilgilerden herhangi biri varsa, domain kesinlikle müsait değildir
  const hasRegistrationInfo = 
    lowerData.includes('registrar:') ||
    lowerData.includes('creation date:') ||
    lowerData.includes('expiration date:') ||
    lowerData.includes('name server:') ||
    lowerData.includes('domain status:') ||
    lowerData.includes('registrant:') ||
    lowerData.includes('admin:') ||
    lowerData.includes('tech:');

  return isAvailable && !hasRegistrationInfo;
}

function isRateLimited(data: string): boolean {
  const lowerData = data.toLowerCase();
  return lowerData.includes('rate limit') || 
         lowerData.includes('rate limit exceeded') ||
         lowerData.includes('try again after') ||
         lowerData.includes('please try again later');
}

function formatDate(dateStr: string): string {
  try {
    // ISO formatındaki tarihleri işle (örn: 2026-05-10T09:15:48Z)
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // Tarih geçersizse orijinal string'i döndür
      return dateStr;
    }
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function parseWhoisData(data: string): ParsedWhoisData {
  const lines = data.split('\n');
  const result: ParsedWhoisData = {};

  // Rate limit kontrolü
  if (isRateLimited(data)) {
    result.isRateLimited = true;
    return result;
  }

  // Format kontrolü
  const isComTr = data.includes('** Domain Name:') && data.includes('** Registrar:');
  const isCoUk = data.includes('Domain name:') && data.includes('Nominet UK');

  if (isComTr) {
    // .com.tr formatı için özel parse
    for (const line of lines) {
      if (!line.trim()) continue;

      // Kayıt şirketi
      if (line.includes('Organization Name')) {
        const registrar = line.split(':')[1]?.trim();
        if (registrar) {
          result.registrar = registrar;
        }
      }
      // Oluşturulma tarihi
      else if (line.includes('Created on')) {
        const dateStr = line.split(':')[1]?.trim();
        if (dateStr) {
          result.creationDate = formatDate(dateStr);
        }
      }
      // Bitiş tarihi
      else if (line.includes('Expires on')) {
        const dateStr = line.split(':')[1]?.trim();
        if (dateStr) {
          result.expirationDate = formatDate(dateStr);
        }
      }
      // Durum
      else if (line.includes('Domain Status:')) {
        const status = line.split(':')[1]?.trim();
        if (status) {
          result.status = status;
        }
      }
      // Name serverlar
      else if (line.includes('** Domain Servers:')) {
        result.nameServers = [];
      }
      else if (result.nameServers && line.trim() && !line.includes('**')) {
        result.nameServers.push(line.trim());
      }
    }
  } else if (isCoUk) {
    // .co.uk formatı için özel parse
    for (const line of lines) {
      if (!line.trim()) continue;

      // Kayıt şirketi
      if (line.includes('Registrar:')) {
        const registrar = line.split('[')[0].replace('Registrar:', '').trim();
        if (registrar) {
          result.registrar = registrar;
        }
      }
      // Oluşturulma tarihi
      else if (line.includes('Registered on:')) {
        const dateStr = line.split(':')[1]?.trim();
        if (dateStr) {
          result.creationDate = formatDate(dateStr);
        }
      }
      // Bitiş tarihi
      else if (line.includes('Expiry date:')) {
        const dateStr = line.split(':')[1]?.trim();
        if (dateStr) {
          result.expirationDate = formatDate(dateStr);
        }
      }
      // Durum
      else if (line.includes('Registration status:')) {
        const status = line.split(':')[1]?.trim();
        if (status) {
          result.status = status;
        }
      }
      // Name serverlar
      else if (line.includes('Name servers:')) {
        result.nameServers = [];
      }
      else if (result.nameServers && line.trim() && !line.includes('Name servers:') && !line.includes('WHOIS lookup')) {
        // IP adreslerini kaldır
        const ns = line.split(' ')[0].trim();
        if (ns && !result.nameServers.includes(ns)) {
          result.nameServers.push(ns);
        }
      }
    }
  } else {
    // Standart WHOIS formatı için parse
    for (const line of lines) {
      if (!line.trim()) continue;

      const [key, ...valueParts] = line.split(':');
      if (!key || !valueParts.length) continue;

      const cleanKey = key.trim().toLowerCase();
      const value = valueParts.join(':').trim();

      if (key.trim() === 'Registrar') {
        const registrar = value.split('(')[0].trim();
        if (registrar && registrar !== 'N/A' && !registrar.includes('REDACTED')) {
          result.registrar = registrar;
        }
      } else if (cleanKey.includes('creation date') || cleanKey.includes('created') || cleanKey.includes('registration date')) {
        result.creationDate = formatDate(value);
      } else if (key.trim() === 'Registrar Registration Expiration Date') {
        result.expirationDate = formatDate(value);
      } else if (key.trim() === 'Domain Status') {
        const status = value.split(' ')[0].trim();
        if (status && status !== 'N/A' && !status.includes('REDACTED')) {
          result.status = status;
        }
      } else if (cleanKey.includes('name server')) {
        if (!result.nameServers) result.nameServers = [];
        const ns = value.split('(')[0].trim();
        if (ns && !result.nameServers.includes(ns)) {
          result.nameServers.push(ns);
        }
      }
    }
  }

  // Domain durumunu kontrol et
  result.isAvailable = isDomainAvailable(data);

  return result;
}

const whoisLookup = promisify(whois.lookup);

const MAX_RETRIES = 3;
const RETRY_DELAY = 3000; // 3 saniye
const BATCH_SIZE = 1; // Tek tek sorgula
const BATCH_DELAY = 5000; // 5 saniye
const RATE_LIMIT_DELAY = 30000; // 30 saniye

const JSONWHOIS_ACCOUNT = '720552000';

const RAPIDAPI_HOST = 'whois-by-api-ninjas.p.rapidapi.com';

// Alternatif WHOIS API
const ALTERNATIVE_WHOIS_API = 'https://api.whoisfreaks.com/v1.0/whois';

// API Keys should be in environment variables
const JSONWHOIS_API_KEY = process.env.JSONWHOIS_API_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const WHOISFREAKS_API_KEY = process.env.WHOISFREAKS_API_KEY;

async function queryAlternativeWhoisApi(domain: string): Promise<ParsedWhoisData> {
  try {
    const response = await fetch(`${ALTERNATIVE_WHOIS_API}?apiKey=${WHOISFREAKS_API_KEY}&domainName=${domain}&type=live`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) { // Too Many Requests
        console.log('Alternative WHOIS API rate limit detected, waiting...');
        await sleep(RATE_LIMIT_DELAY);
        return queryAlternativeWhoisApi(domain); // Yeniden dene
      }
      throw new Error(`Alternative WHOIS API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      isAvailable: !data.is_registered,
      registrar: data.registrar?.name,
      creationDate: data.created_date,
      expirationDate: data.expires_date,
      nameServers: data.name_servers,
      status: data.status,
      rawData: JSON.stringify(data, null, 2),
      isRateLimited: false
    };
  } catch (error) {
    console.error('Alternative WHOIS API error:', error);
    throw error;
  }
}

async function queryJsonWhoisApi(domain: string): Promise<ParsedWhoisData> {
  try {
    const response = await fetch(`https://jsonwhoisapi.com/api/v1/whois?identifier=${domain}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${JSONWHOIS_ACCOUNT}:${JSONWHOIS_API_KEY}`).toString('base64')}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) { // Too Many Requests
        console.log('JSONWHOIS API rate limit detected, trying Alternative WHOIS API...');
        try {
          return await queryAlternativeWhoisApi(domain);
        } catch (altError) {
          console.error('Alternative WHOIS API also failed:', altError);
          throw new Error('All APIs are rate limited');
        }
      }
      throw new Error(`JSONWHOIS API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      isAvailable: !data.available,
      registrar: data.registrar?.name,
      creationDate: data.created_date,
      expirationDate: data.expires_date,
      nameServers: data.nameservers?.map((ns: any) => ns.hostname),
      status: data.status?.join(', '),
      rawData: JSON.stringify(data, null, 2),
      isRateLimited: false
    };
  } catch (error) {
    console.error('JSONWHOIS API error:', error);
    throw error;
  }
}

async function queryRapidApi(domain: string): Promise<ParsedWhoisData> {
  try {
    const response = await fetch(`https://${RAPIDAPI_HOST}/v1/whois?domain=${domain}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });

    if (!response.ok) {
      if (response.status === 429) { // Too Many Requests
        console.log('RapidAPI rate limit detected, waiting...');
        await sleep(RATE_LIMIT_DELAY);
        return queryRapidApi(domain); // Yeniden dene
      }
      throw new Error(`RapidAPI error: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      isAvailable: !data.is_registered,
      registrar: data.registrar?.name,
      creationDate: data.creation_date,
      expirationDate: data.expiration_date,
      nameServers: data.name_servers,
      status: data.status,
      rawData: JSON.stringify(data, null, 2),
      isRateLimited: false
    };
  } catch (error) {
    console.error('RapidAPI error:', error);
    throw error;
  }
}

async function queryWhoisServer(domain: string, server: string): Promise<ParsedWhoisData> {
  try {
    const response = await fetch(`https://${server}/whois/${domain}`);
    if (!response.ok) {
      throw new Error(`WHOIS server error: ${response.statusText}`);
    }

    const data = await response.text();
    
    // Rate limit kontrolü
    if (isRateLimited(data)) {
      console.log(`Rate limit detected for ${domain}, trying JSONWHOIS API...`);
      return await queryJsonWhoisApi(domain);
    }

    return parseWhoisData(data);
  } catch (error) {
    console.error(`WHOIS server error for ${server}:`, error);
    throw error;
  }
}

async function queryWhoisWithRetry(domain: string, retries = MAX_RETRIES, onProgress?: (progress: number) => void): Promise<any> {
  try {
    // Domain'i temizle ve TLD'yi çıkar
    const cleanDomain = domain.trim().toLowerCase();
    const tld = cleanDomain.split('.').pop() || '';
    
    console.log(`WHOIS sorgusu başlatılıyor: ${cleanDomain} (TLD: ${tld})`);
    
    // WHOIS sunucusunu bul
    const server = WHOIS_SERVERS[tld];
    
    if (!server) {
      console.log(`WHOIS sunucusu bulunamadı: ${tld}`);
      if (onProgress) onProgress(1);
      return {
        domain: cleanDomain,
        success: false,
        error: `Desteklenmeyen TLD: ${tld}`,
        server: 'unknown'
      };
    }

    console.log(`WHOIS sunucusu seçildi: ${server}`);

    try {
      // WHOIS sorgusu yap
      const data = await new Promise((resolve, reject) => {
        const options = {
          server: server,
          timeout: 30000,
          follow: 3,
        };

        console.log(`WHOIS sorgusu yapılıyor: ${cleanDomain}`, options);

        whois.lookup(cleanDomain, options, (err: any, data: any) => {
          if (err) {
            console.error(`WHOIS sorgu hatası (${cleanDomain}):`, err);
            reject(err);
          } else {
            console.log(`WHOIS sorgusu başarılı: ${cleanDomain}`);
            resolve(data);
          }
        });
      });

      // WHOIS verisini parse et
      const whoisData = data as string;
      console.log(`WHOIS verisi alındı (${cleanDomain}):`, whoisData.substring(0, 100) + '...');

      // Rate limit kontrolü
      if (isRateLimited(whoisData)) {
        console.log(`Rate limit detected for ${cleanDomain}`);
        if (onProgress) onProgress(1);
        return {
          domain: cleanDomain,
          success: false,
          error: 'Rate limit aşıldı. Lütfen daha sonra tekrar deneyin.',
          server,
          isRateLimited: true
        };
      }

      const parsedData = parseWhoisData(whoisData);
      console.log(`WHOIS verisi parse edildi (${cleanDomain}):`, parsedData);

      if (onProgress) onProgress(1);

      return {
        domain: cleanDomain,
        success: true,
        data: {
          registrar: parsedData.registrar || 'N/A',
          creationDate: parsedData.creationDate || 'N/A',
          expirationDate: parsedData.expirationDate || 'N/A',
          status: parsedData.status || 'N/A',
          nameServers: parsedData.nameServers || [],
          isAvailable: parsedData.isAvailable,
          isRateLimited: false,
          rawData: whoisData
        },
        server
      };
    } catch (error: any) {
      console.error(`WHOIS sorgu hatası (${cleanDomain}):`, error);
      
      if (retries > 0) {
        console.log(`Yeniden deneme yapılıyor (${cleanDomain}), kalan deneme: ${retries}`);
        await sleep(RETRY_DELAY);
        return queryWhoisWithRetry(cleanDomain, retries - 1, onProgress);
      }

      if (onProgress) onProgress(1);

      return {
        domain: cleanDomain,
        success: false,
        error: `WHOIS sunucusuna bağlanırken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`,
        server
      };
    }
  } catch (error: any) {
    console.error(`WHOIS sorgu hatası (${domain}):`, error);

    if (retries > 0) {
      console.log(`Yeniden deneme yapılıyor (${domain}), kalan deneme: ${retries}`);
      await sleep(RETRY_DELAY);
      return queryWhoisWithRetry(domain, retries - 1, onProgress);
    }

    if (onProgress) onProgress(1);

    return {
      domain: domain.trim(),
      success: false,
      error: `WHOIS sunucusuna bağlanırken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`,
      server: WHOIS_SERVERS[domain.split('.').pop()?.toLowerCase() || ''] || 'unknown'
    };
  }
}

export async function POST(request: Request) {
  let aborted = false;
  // @ts-ignore
  if (request.body && typeof request.body.on === 'function') {
    // Node.js stream (for dev or custom server)
    // @ts-ignore
    request.body.on('close', () => {
      aborted = true;
      console.log('WHOIS API: Client disconnected, aborting batch processing.');
    });
  }
  try {
    const { domains } = await request.json();
    if (!Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { error: 'Geçerli domain listesi gerekli' },
        { status: 400 }
      );
    }
    const results = [];
    const totalDomains = domains.length;
    let processedDomains = 0;
    // İlerleme durumunu sıfırla
    updateProgress(0, totalDomains);
    // Domainleri daha küçük gruplara böl
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      if (aborted) {
        console.log('WHOIS API: Batch processing aborted.');
        break;
      }
      const batch = domains.slice(i, i + BATCH_SIZE);
      console.log(`Batch ${i / BATCH_SIZE + 1} başlatılıyor:`, batch);
      // Her batch için paralel sorgu
      const batchResults = await Promise.all(
        batch.map(async (domain) => {
          try {
            const result = await queryWhoisWithRetry(domain);
            processedDomains++;
            // İlerleme durumunu güncelle
            updateProgress(processedDomains, totalDomains);
            return result;
          } catch (error) {
            console.error(`Domain sorgu hatası (${domain}):`, error);
            processedDomains++;
            // İlerleme durumunu güncelle
            updateProgress(processedDomains, totalDomains);
            return {
              domain,
              success: false,
              error: error instanceof Error ? error.message : 'Bilinmeyen hata',
              server: 'unknown'
            };
          }
        })
      );
      results.push(...batchResults);
      // Son batch değilse bekle
      if (i + BATCH_SIZE < domains.length && !aborted) {
        console.log(`${BATCH_DELAY}ms bekleniyor...`);
        await sleep(BATCH_DELAY);
      }
    }
    // Son ilerleme durumunu güncelle
    updateProgress(totalDomains, totalDomains);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('WHOIS API hatası:', error);
    return NextResponse.json(
      { error: 'WHOIS sorgusu sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
} 