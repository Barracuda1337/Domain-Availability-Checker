'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Globe, Calendar, Building2, Server, AlertCircle, CheckCircle2, XCircle, CheckSquare2, Square, ArrowLeft, BookmarkPlus, Plus, Check } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast"

interface WhoisResult {
  domain: string;
  success: boolean;
  data?: {
    registrar: string;
    creationDate: string;
    expirationDate: string;
    status: string;
    nameServers: string[];
    isAvailable?: boolean;
    rawData: string;
  };
  error?: string;
  server: string;
}

const POPULAR_TLDS = [
  { value: '.com', label: '.com' },
  { value: '.net', label: '.net' },
  { value: '.org', label: '.org' },
  { value: '.com.tr', label: '.com.tr' },
  { value: '.co.uk', label: '.co.uk' },
  { value: '.io', label: '.io' },
  { value: '.app', label: '.app' },
  { value: '.dev', label: '.dev' },
  { value: '.me', label: '.me' },
  { value: '.info', label: '.info' }
];

export default function BulkCheck() {
  const [domains, setDomains] = useState('');
  const [results, setResults] = useState<WhoisResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTlds, setSelectedTlds] = useState<string[]>(['.com', '.net', '.org', '.com.tr', '.co.uk']);
  const [savingDomain, setSavingDomain] = useState<string | null>(null);
  const { toast } = useToast()

  const toggleTld = (tld: string) => {
    setSelectedTlds(prev => 
      prev.includes(tld) 
        ? prev.filter(t => t !== tld)
        : [...prev, tld]
    );
  };

  const toggleAllTlds = () => {
    setSelectedTlds(prev => 
      prev.length === POPULAR_TLDS.length 
        ? [] 
        : POPULAR_TLDS.map(t => t.value)
    );
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);

    try {
      const domainList = domains
        .split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      if (domainList.length === 0) {
        setError('Lütfen en az bir domain girin');
        return;
      }

      // Her domain için seçili uzantıları kontrol et
      const domainsToCheck = domainList.flatMap(domain => {
        if (domain.includes('.')) {
          return [domain];
        }
        return selectedTlds.map(tld => `${domain}${tld}`);
      });

      const response = await fetch('/api/whois', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domains: domainsToCheck }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'WHOIS sorgusu başarısız oldu');
      }

      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="text-center mb-8 pt-8">
          <Link 
            href="/" 
            className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ana Sayfaya Dön
          </Link>
          <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 animate-gradient">
            Uzantısız Domain Kontrolü
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Domain adını yazın ve popüler uzantılarda müsaitlik durumunu kontrol edin
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Uzantı Seçimi</h2>
            <button
              onClick={toggleAllTlds}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
            >
              {selectedTlds.length === POPULAR_TLDS.length ? (
                <>
                  <CheckSquare2 className="h-4 w-4 mr-1" />
                  Tümünü Kaldır
                </>
              ) : (
                <>
                  <Square className="h-4 w-4 mr-1" />
                  Tümünü Seç
                </>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {POPULAR_TLDS.map((tld) => (
              <label
                key={tld.value}
                className={`flex items-center space-x-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedTlds.includes(tld.value)
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTlds.includes(tld.value)}
                  onChange={() => toggleTld(tld.value)}
                  className="hidden"
                />
                <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                  selectedTlds.includes(tld.value)
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-400 dark:border-gray-600'
                }`}>
                  {selectedTlds.includes(tld.value) && (
                    <CheckSquare2 className="w-3 h-3 text-white" />
                  )}
                </div>
                <span className="text-sm font-medium">{tld.label}</span>
              </label>
            ))}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              id="domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              className="w-full h-40 p-4 border rounded-xl shadow-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-white transition-all duration-200"
              placeholder="example&#10;test&#10;mywebsite"
            />
          </div>

          <Button 
            type="submit" 
            disabled={loading || selectedTlds.length === 0}
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
                Uzantıları Kontrol Et
              </>
            )}
          </Button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-xl flex items-center shadow-lg">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">Sonuçlar</h2>
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-6 rounded-xl shadow-lg transition-all duration-200 ${
                  result.success 
                    ? result.data?.isAvailable
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                    <Globe className="inline-block h-5 w-5 mr-2 text-blue-500" />
                    {result.domain}
                  </h3>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium flex items-center ${
                    result.success 
                      ? result.data?.isAvailable
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {result.success ? (
                      result.data?.isAvailable ? (
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

                {result.success && result.data?.isAvailable && (
                  <div className="mt-4 flex items-center gap-2">
                    {result.data.isAvailable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveDomain(result.domain)}
                        disabled={savingDomain === result.domain}
                      >
                        {savingDomain === result.domain ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        <span className="ml-2">Listeye Kaydet</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        <span className="ml-2">Zaten Listede</span>
                      </Button>
                    )}
                  </div>
                )}

                {result.success && result.data && !result.data.isAvailable && (
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <Building2 className="h-5 w-5 mr-3 text-blue-500" />
                        <div>
                          <span className="font-medium block text-sm text-gray-500 dark:text-gray-400">Kayıt Şirketi</span>
                          <span>{result.data.registrar}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <Calendar className="h-5 w-5 mr-3 text-blue-500" />
                        <div>
                          <span className="font-medium block text-sm text-gray-500 dark:text-gray-400">Oluşturulma</span>
                          <span>{result.data.creationDate}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <Calendar className="h-5 w-5 mr-3 text-blue-500" />
                        <div>
                          <span className="font-medium block text-sm text-gray-500 dark:text-gray-400">Son Kullanma</span>
                          <span>{result.data.expirationDate}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                        <AlertCircle className="h-5 w-5 mr-3 text-blue-500" />
                        <div>
                          <span className="font-medium block text-sm text-gray-500 dark:text-gray-400">Durum</span>
                          <span>{result.data.status}</span>
                        </div>
                      </div>
                    </div>

                    {result.data.nameServers.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                        <div className="flex items-center text-gray-600 dark:text-gray-400 mb-3">
                          <Server className="h-5 w-5 mr-3 text-blue-500" />
                          <span className="font-medium">Name Serverlar</span>
                        </div>
                        <ul className="space-y-2">
                          {result.data.nameServers.map((ns, i) => (
                            <li key={i} className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                              {ns}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {!result.success && (
                  <div className="mt-4 flex items-center text-red-600 dark:text-red-400 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    {result.error}
                  </div>
                )}

                {result.success && result.data && !result.data.isAvailable && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      WHOIS Sunucusu: {result.server}
                    </p>
                    <div className="mt-4">
                      <details className="text-sm">
                        <summary className="cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                          Ham WHOIS Verisi
                        </summary>
                        <pre className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg overflow-x-auto text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                          {result.data.rawData}
                        </pre>
                      </details>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 