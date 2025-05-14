'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Globe, Calendar, Building2, Server, AlertCircle, CheckCircle2, XCircle, CheckSquare2, Square, ArrowLeft, BookmarkPlus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast"

interface SavedDomain {
  id: number;
  domain: string;
  createdAt: string;
  isAvailable?: boolean;
  lastChecked?: string;
}

export default function SavedDomains() {
  const [domains, setDomains] = useState<SavedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingDomain, setUpdatingDomain] = useState<string | null>(null);
  const [updatingAll, setUpdatingAll] = useState(false);
  const { toast } = useToast();

  const fetchDomains = async () => {
    try {
      const response = await fetch('/api/saved-domains');
      if (!response.ok) {
        throw new Error('Domainler yüklenemedi');
      }
      const data = await response.json();
      setDomains(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const updateDomainStatus = async (domain: string) => {
    setUpdatingDomain(domain);
    try {
      const response = await fetch('/api/whois', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domains: [domain] }),
      });

      if (!response.ok) {
        throw new Error('Domain durumu güncellenemedi');
      }

      const data = await response.json();
      const result = data.results[0];

      // Domain durumunu güncelle
      setDomains(prev => prev.map(d => 
        d.domain === domain 
          ? { ...d, isAvailable: result.data?.isAvailable, lastChecked: new Date().toISOString() }
          : d
      ));

      toast({
        variant: "success",
        title: "Güncellendi!",
        description: `${domain} durumu güncellendi.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Hata!",
        description: err instanceof Error ? err.message : 'Domain durumu güncellenirken bir hata oluştu',
      });
    } finally {
      setUpdatingDomain(null);
    }
  };

  const updateAllDomains = async () => {
    setUpdatingAll(true);
    try {
      const domainsToCheck = domains.map(d => d.domain);
      const response = await fetch('/api/whois', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domains: domainsToCheck }),
      });

      if (!response.ok) {
        throw new Error('Domainler güncellenemedi');
      }

      const data = await response.json();
      
      // Tüm domainlerin durumunu güncelle
      setDomains(prev => prev.map(d => {
        const result = data.results.find((r: any) => r.domain === d.domain);
        return {
          ...d,
          isAvailable: result?.data?.isAvailable,
          lastChecked: new Date().toISOString()
        };
      }));

      toast({
        variant: "success",
        title: "Güncellendi!",
        description: "Tüm domainlerin durumu güncellendi.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Hata!",
        description: err instanceof Error ? err.message : 'Domainler güncellenirken bir hata oluştu',
      });
    } finally {
      setUpdatingAll(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/saved-domains/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Domain silinemedi');
      }

      setDomains(prev => prev.filter(d => d.id !== id));
      toast({
        variant: "success",
        title: "Silindi!",
        description: "Domain başarıyla silindi.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Hata!",
        description: err instanceof Error ? err.message : 'Domain silinirken bir hata oluştu',
      });
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const filteredDomains = domains.filter(domain =>
    domain.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

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
            Kaydedilen Domainler
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="relative flex-1 mr-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Domain ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={updateAllDomains}
              disabled={updatingAll || domains.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updatingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Güncelleniyor...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tümünü Güncelle
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-xl flex items-center shadow-lg mb-4">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}

          {filteredDomains.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz kaydedilmiş domain yok'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDomains.map((domain) => (
                <div
                  key={domain.id}
                  className={`p-4 rounded-xl shadow-sm transition-all duration-200 ${
                    domain.isAvailable === undefined
                      ? 'bg-gray-50 dark:bg-gray-700/50'
                      : domain.isAvailable
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <Globe className="h-5 w-5 mr-2 text-blue-500" />
                        <span className="text-lg font-medium">{domain.domain}</span>
                      </div>
                      {domain.isAvailable !== undefined && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center ${
                          domain.isAvailable
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {domain.isAvailable ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Boşta
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Satın Alınmış
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateDomainStatus(domain.domain)}
                        disabled={updatingDomain === domain.domain}
                      >
                        {updatingDomain === domain.domain ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-2">Güncelle</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(domain.id)}
                      >
                        Sil
                      </Button>
                    </div>
                  </div>
                  {domain.lastChecked && (
                    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Son kontrol: {new Date(domain.lastChecked).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 