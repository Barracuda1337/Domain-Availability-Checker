'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Globe, Calendar, Building2, Server, AlertCircle, CheckCircle2, XCircle, BookmarkPlus, Plus, Check } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast"

interface WhoisResult {
  domain: string;
  success: boolean;
  data?: {
    isAvailable: boolean;
    registrar?: string;
    creationDate?: string;
    expirationDate?: string;
    nameServers?: string[];
    status?: string;
    rawData?: string;
    isRateLimited?: boolean;
  };
  available?: boolean;
  error?: string;
  server: string;
  otherResults?: Record<string, {
    result?: WhoisResult;
    loading: boolean;
  }>;
}

interface CacheEntry {
  result: WhoisResult;
  timestamp: number;
}

// Önbellek için basit bir cache mekanizması
const domainCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 1000 * 60 * 60; // 1 saat

// Dinamik batch size için yardımcı fonksiyonlar
const getInitialBatchSize = (totalDomains: number): number => {
  if (totalDomains <= 5) return totalDomains;
  if (totalDomains <= 10) return 5;
  return 10;
};

const adjustBatchSize = (currentSize: number, successRate: number): number => {
  if (successRate > 0.9) return Math.min(currentSize + 2, 20);
  if (successRate < 0.7) return Math.max(currentSize - 2, 3);
  return currentSize;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiting için yardımcı fonksiyonlar
const RATE_LIMIT_DELAY = 2000; // 2 saniye
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 saniye

export default function Home() {
  const [domains, setDomains] = useState('');
  const [results, setResults] = useState<WhoisResult[]>([]);
  const [mainDomains, setMainDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [totalDomains, setTotalDomains] = useState(0);
  const [processedDomains, setProcessedDomains] = useState(0);
  const [error, setError] = useState('');
  const [savingDomain, setSavingDomain] = useState<string | null>(null);
  const [savedDomains, setSavedDomains] = useState<string[]>([]);
  const { toast } = useToast();
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const [checkingAlternatives, setCheckingAlternatives] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  // Yeni progressive batch fonksiyonu
  const processBatchProgressive = async (
    domains: string[],
    batchSize: number,
    controller: AbortController,
    onBatchDone: (batchResults: WhoisResult[]) => void
  ) => {
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      let retryCount = 0;
      let lastError: Error | null = null;
      let batchResults: WhoisResult[] = [];
      while (retryCount < MAX_RETRIES) {
        try {
          const response = await fetch('/api/whois', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domains: batch, batchSize }),
            signal: controller.signal
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'WHOIS sorgusu başarısız oldu');
          }
          const data = await response.json();
          if (!data.results) throw new Error('Sonuçlar alınamadı');
          // Sonuçları önbelleğe al
          data.results.forEach((result: WhoisResult) => {
            domainCache.set(result.domain, {
              result,
              timestamp: Date.now()
            });
          });
          batchResults = batch.map(domain => {
            const newResult = data.results.find((r: WhoisResult) => r.domain === domain);
            return newResult || {
              domain,
              success: false,
              error: 'Sonuç bulunamadı',
              server: ''
            };
          });
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Bilinmeyen hata');
          if (error instanceof Error && error.message.includes('rate limit')) {
            await sleep(RATE_LIMIT_DELAY);
            retryCount++;
            continue;
          }
          break;
        }
      }
      if (batchResults.length === 0 && lastError) {
        batchResults = batch.map(domain => ({
          domain,
          success: false,
          error: lastError?.message || 'Bir hata oluştu',
          server: ''
        }));
      }
      onBatchDone(batchResults);
      await sleep(200); // küçük bir gecikme, UI için
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    if (abortController) {
      abortController.abort();
    }
    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setError('');
    setResults([]);
    setMainDomains([]);
    setLoadingProgress(0);
    setProcessedDomains(0);
    setCheckingAlternatives(false);
    setProgress({ current: 0, total: 0 });
    try {
      const domainList = domains
        .split('\n')
        .map(d => cleanDomain(d.trim()))
        .filter(d => d.length > 0 && isValidDomain(d));
      if (domainList.length === 0) {
        setError('Lütfen en az bir geçerli domain girin');
        return;
      }
      // 1. Ana domainleri (sadece .com) ayır
      const mainDomainsArr = domainList.map(domain => {
        const parts = domain.split('.');
        const name = parts[0];
        return name + '.com';
      });
      setMainDomains(mainDomainsArr);
      // 2. Alternatifleri hazırla
      const allTlds = ['.org', '.net', '.com.tr'];
      const alternativeDomains = domainList.flatMap(domain => {
        const parts = domain.split('.');
        const name = parts[0];
        return allTlds.map(tld => name + tld);
      });
      setTotalDomains(mainDomainsArr.length + alternativeDomains.length);
      // 3. Önce ana .com domainleri sorgula
      await processBatchProgressive(
        mainDomainsArr,
        getInitialBatchSize(mainDomainsArr.length),
        controller,
        (batchResults) => {
          setResults(prev => [...prev, ...batchResults]);
        }
      );
      // 4. Sonra alternatifleri sorgula
      await processBatchProgressive(
        alternativeDomains,
        getInitialBatchSize(alternativeDomains.length),
        controller,
        (batchResults) => {
          setResults(prev => [...prev, ...batchResults]);
        }
      );
      for (const result of results) {
        if (result.success && result.data?.isAvailable) {
          await checkDomainInList(result.domain);
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Sorgu iptal edildi');
        return;
      }
      console.error('WHOIS sorgu hatası:', error);
      setError(error instanceof Error ? error.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
      setCheckingAlternatives(false);
      setLoadingProgress(100);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      setAbortController(null);
    }
  };

  const checkProgress = async () => {
    try {
      const response = await fetch('/api/whois-progress');
      const data = await response.json();
      
      if (data.percentage !== loadingProgress || 
          data.processed !== processedDomains || 
          data.total !== totalDomains) {
        setLoadingProgress(data.percentage);
        setProcessedDomains(data.processed);
        setTotalDomains(data.total);
      }
    } catch (error) {
      console.error('İlerleme durumu alınamadı:', error);
    }
  };

  const checkDomainInList = async (domain: string) => {
    try {
      const response = await fetch(`/api/check-domain?domain=${encodeURIComponent(domain)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setSavedDomains(prev => [...prev, domain]);
        }
      }
    } catch (error) {
      console.error('Domain kontrol hatası:', error);
    }
  };

  const isValidDomain = (domain: string): boolean => {
    const cleanDomain = domain.replace(/\s+/g, '');
    
    const validTlds = ['.com', '.org', '.net', '.com.tr'];
    return validTlds.some(tld => cleanDomain.toLowerCase().endsWith(tld));
  };

  const cleanDomain = (domain: string): string => {
    return domain.replace(/\s+/g, '').toLowerCase();
  };

  const handleSaveDomain = async (domain: string) => {
    setSavingDomain(domain);
    try {
      const response = await fetch('/api/save-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain }),
      });

      if (!response.ok) {
        throw new Error('Domain kaydedilemedi');
      }

      setSavedDomains(prev => [...prev, domain]);
      toast({
        variant: "success",
        title: "Başarılı!",
        description: `${domain} başarıyla kaydedildi.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Hata!",
        description: err instanceof Error ? err.message : 'Domain kaydedilirken bir hata oluştu',
      });
    } finally {
      setSavingDomain(null);
    }
  };

  const handleBulkUpdate = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    setLoadingProgress(0);
    setProcessedDomains(0);

    try {
      const response = await fetch('/api/saved-domains');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Kaydedilen domainler alınamadı');
      }

      const domains = data.domains
        .map((domain: string) => cleanDomain(domain))
        .filter((domain: string) => isValidDomain(domain));

      if (domains.length === 0) {
        setError('Güncellenecek geçerli domain bulunamadı');
        return;
      }

      setTotalDomains(domains.length);

      const interval = setInterval(async () => {
        try {
          const response = await fetch('/api/whois-progress');
          const data = await response.json();
          setProgress(data);
        } catch (error) {
          console.error('İlerleme kontrolü hatası:', error);
        }
      }, 1000);

      const updatedResults = [];
      for (let i = 0; i < domains.length; i++) {
        const domain = domains[i];
        setProcessedDomains(i + 1);
        
        try {
          const whoisResponse = await fetch('/api/whois', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ domains: [domain] }),
          });

          const whoisData = await whoisResponse.json();

          if (!whoisResponse.ok) {
            throw new Error(whoisData.error || 'WHOIS sorgusu başarısız oldu');
          }

          if (whoisData.results && whoisData.results.length > 0) {
            const result = whoisData.results[0];
            
            if (result.success && !result.data?.isAvailable) {
              await fetch('/api/remove-domain', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ domain }),
              });
            }
            
            updatedResults.push(result);
          }

          if (i < domains.length - 1) {
            await sleep(2000);
          }
        } catch (err) {
          console.error(`${domain} güncellenirken hata:`, err);
          updatedResults.push({
            domain,
            success: false,
            error: err instanceof Error ? err.message : 'Güncelleme hatası'
          });
        }
      }

      setResults(updatedResults);

      for (const result of updatedResults) {
        if (result.success && result.data?.isAvailable) {
          await checkDomainInList(result.domain);
        }
      }
    } catch (err) {
      console.error('Toplu güncelleme hatası:', err);
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
      setLoadingProgress(100);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="text-center mb-8 pt-8">
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 animate-gradient">
            Domain Kontrol Aracı
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">
            Domain müsaitlik durumunu kontrol edin ve boşta olanları kaydedin
          </p>
          <div className="flex justify-center space-x-4">
            <Link 
              href="/bulk-check" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Globe className="w-5 h-5 mr-2" />
              Uzantısız Domain Kontrolü
            </Link>
            <Link 
              href="/saved-domains" 
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <BookmarkPlus className="w-5 h-5 mr-2" />
              Kaydedilen Domainler
            </Link>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              id="domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              className="w-full h-40 p-4 border rounded-xl shadow-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white transition-all duration-200"
              placeholder="example.com&#10;test.com&#10;mywebsite.com"
            />
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl shadow-lg transition-all duration-200 h-12 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Sorgulanıyor...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Kontrol Et
              </>
            )}
          </Button>

          {loading && (
            <div className="mt-4 space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {processedDomains} / {totalDomains} domain sorgulandı ({Math.round(loadingProgress)}%)
              </div>
            </div>
          )}
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-xl flex items-center shadow-lg">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {mainDomains.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Sonuçlar</h2>
            {mainDomains.map((mainDomain, idx) => {
              const mainResult = results.find(r => r.domain === mainDomain);
              const name = mainDomain.replace('.com', '');
              return (
                <div key={mainDomain} className="mb-6 p-6 rounded-xl shadow-lg bg-white dark:bg-gray-800">
                  {/* Ana domain sonucu */}
                  {mainResult ? (
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                        <Globe className="inline-block h-5 w-5 mr-2 text-blue-500" />
                        {mainResult.domain}
                      </h3>
                      <div className="flex items-center space-x-4">
                        <div className="flex space-x-2">
                          {['.org', '.net', '.com.tr'].map((tld) => {
                            const altDomain = name + tld;
                            const altResult = results.find(r => r.domain === altDomain);
                            return (
                              <div
                                key={tld}
                                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  !altResult
                                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                                    : altResult.data?.isRateLimited
                                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                      : altResult.data?.isAvailable
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}
                                title={tld}
                              >
                                {!altResult ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : altResult.data?.isRateLimited ? (
                                  <AlertCircle className="h-3 w-3" />
                                ) : altResult.data?.isAvailable ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <XCircle className="h-3 w-3" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            onClick={() => handleSaveDomain(mainResult.domain)}
                            disabled={savingDomain === mainResult.domain || savedDomains.includes(mainResult.domain)}
                            className={`${
                              savedDomains.includes(mainResult.domain)
                                ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                          >
                            {savingDomain === mainResult.domain ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Kaydediliyor...
                              </>
                            ) : savedDomains.includes(mainResult.domain) ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Zaten Listede
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="mr-2 h-4 w-4" />
                                Listeye Kaydet
                              </>
                            )}
                          </Button>
                          <span className={`px-4 py-2 rounded-full text-sm font-medium flex items-center ${
                            mainResult.success 
                              ? mainResult.data?.isRateLimited
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : mainResult.data?.isAvailable
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {mainResult.success ? (
                              mainResult.data?.isRateLimited ? (
                                <>
                                  <AlertCircle className="h-4 w-4 mr-2" />
                                  Rate Limit
                                </>
                              ) : mainResult.data?.isAvailable ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Boşta
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Satın Alınmış
                                </>
                              )
                            ) : (
                              <>
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Hata
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Sorgulanıyor...</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
