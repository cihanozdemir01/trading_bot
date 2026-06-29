import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Linking,
  Modal
} from 'react-native';
import {
  CURRENT_APP_VERSION,
  checkForAppUpdates,
  preventVersionConflicts
} from './services/UpdateService';

export default function App() {
  const [activeTab, setActiveTab] = useState('strategy');
  const [loading, setLoading] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [progressPct, setProgressPct] = useState(0);

  // Sunucu (Backend) Bağlantı Adresi & Modal
  const [serverUrl, setServerUrl] = useState('https://trading-bot-33es.onrender.com');
  const [tempServerUrl, setTempServerUrl] = useState('https://trading-bot-33es.onrender.com');
  const [showServerModal, setShowServerModal] = useState(false);

  // Güncelleme Modal & Durumları
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Portföy & Risk Parametreleri
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1h');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('');
  const [balance, setBalance] = useState('1000');
  const [posPct, setPosPct] = useState('10');
  const [maxPos, setMaxPos] = useState('3');
  const [slPct, setSlPct] = useState('1.5');
  const [tpPct, setTpPct] = useState('3.0');

  // STRATEJİ KRİTERLERİ STATE'LERİ
  const [useRsi, setUseRsi] = useState(true);
  const [rsiOp, setRsiOp] = useState('less');
  const [rsiVal1, setRsiVal1] = useState('35');
  const [rsiVal2, setRsiVal2] = useState('70');

  const [useMacd, setUseMacd] = useState(true);
  const [macdCross, setMacdCross] = useState('bullish');
  const [macdZero, setMacdZero] = useState('any');

  const [useEma50200, setUseEma50200] = useState(false);
  const [ema50200Cross, setEma50200Cross] = useState('bullish');

  const [useEma2050, setUseEma2050] = useState(false);
  const [ema2050Cross, setEma2050Cross] = useState('bullish');

  const [useEmaPrice, setUseEmaPrice] = useState(true);
  const [emaPriceFilter, setEmaPriceFilter] = useState('above_ema50');
  const [showEmaPriceModal, setShowEmaPriceModal] = useState(false);

  const emaPriceOptions = [
    { label: 'Fiyat > EMA 50 (Yükseliş Trendi)', value: 'above_ema50' },
    { label: 'Fiyat < EMA 50 (Düşüş Trendi)', value: 'below_ema50' },
    { label: 'Fiyat > EMA 20', value: 'above_ema20' },
    { label: 'Fiyat < EMA 20', value: 'below_ema20' },
    { label: 'Fiyat > EMA 100', value: 'above_ema100' },
    { label: 'Fiyat < EMA 100', value: 'below_ema100' },
    { label: 'Fiyat > EMA 200', value: 'above_ema200' },
    { label: 'Fiyat < EMA 200', value: 'below_ema200' },
  ];

  // Test Sonuçları Verisi
  const [backtestResult, setBacktestResult] = useState({
    final_balance: 1000.0,
    initial_balance: 1000.0,
    total_return_pct: 0.0,
    win_rate: 0.0,
    total_trades: 0,
    max_drawdown_pct: 0.0,
    trades: [],
    ai_advice: ["💡 Test butonuna bastığınızda yapay zeka analiz raporu burada görüntülenecektir."]
  });

  // AI Konsolu
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    preventVersionConflicts();
    checkUpdates();
  }, []);

  const checkUpdates = async () => {
    const info = await checkForAppUpdates();
    if (info && info.hasUpdate) {
      setUpdateInfo(info);
      setShowUpdateModal(true);
    }
  };

  const runBacktest = async () => {
    setLoading(true);
    setProgressPct(10);
    setProgressStatus('⏳ Binance Verileri Çekiliyor...');

    const timer = setInterval(() => {
      setProgressPct((prev) => {
        if (prev < 85) {
          const next = prev + 15;
          if (next >= 40 && next < 70) setProgressStatus('⚙️ İndikatörler Hesaplanıyor...');
          else if (next >= 70) setProgressStatus('📊 Risk & PnL Analizi Yapılıyor...');
          return next;
        }
        return prev;
      });
    }, 200);

    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      let url = `${cleanServerUrl}/backtest?symbol=${symbol}&interval=${interval}&limit=1000`;
      if (startDate.trim()) url += `&start_date=${startDate.trim()}`;
      if (endDate.trim()) url += `&end_date=${endDate.trim()}`;

      url += `&initial_balance=${balance}&position_pct=${posPct}&max_open_positions=${maxPos}`;
      url += `&use_rsi=${useRsi}&use_macd=${useMacd}&use_ema_50_200=${useEma50200}&use_ema_20_50=${useEma2050}&use_ema_price=${useEmaPrice}`;
      url += `&rsi_op=${rsiOp}&rsi_val1=${rsiVal1}&rsi_val2=${rsiVal2}`;
      url += `&macd_cross=${macdCross}&macd_zero=${macdZero}`;
      url += `&ema_50_200_cross=${ema50200Cross}&ema_20_50_cross=${ema2050Cross}&ema_price_filter=${emaPriceFilter}&sl_pct=${slPct}&tp_pct=${tpPct}`;

      const response = await fetch(url);
      const data = await response.json();

      clearInterval(timer);
      setProgressPct(100);
      setProgressStatus('✅ Test Tamamlandı!');
      setBacktestResult(data);
    } catch (error) {
      clearInterval(timer);
      Alert.alert(
        'Bağlantı Hatası',
        `Backend sunucusuna bağlanılamadı (${serverUrl}).\n\nHata: ` + error.message
      );
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  };

  const askAIConsult = async (queryText) => {
    setAiQuery(queryText);
    setAiLoading(true);
    setAiResponse('⏳ Derin yapay zeka analiz motoru veri üretiyor...');

    try {
      const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
      const response = await fetch(`${cleanServerUrl}/ai-consult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_query: queryText,
          symbol: symbol,
          interval: interval,
          win_rate: backtestResult.win_rate || 0,
          profit_factor: backtestResult.profit_factor || 0,
          total_trades: backtestResult.total_trades || 0,
          max_drawdown: backtestResult.max_drawdown_pct || 0
        })
      });
      const data = await response.json();
      setAiResponse(data.reply);
    } catch (e) {
      setAiResponse('❌ AI Danışmanına bağlanırken hata oluştu.');
    } finally {
      setAiLoading(false);
    }
  };

  const saveServerUrl = () => {
    setServerUrl(tempServerUrl);
    setShowServerModal(false);
    Alert.alert('Sunucu Güncellendi', `Yeni sunucu adresi kaydedildi:\n${tempServerUrl}`);
  };

  const pnlNet = backtestResult.final_balance - backtestResult.initial_balance;
  const selectedEmaLabel = emaPriceOptions.find(o => o.value === emaPriceFilter)?.label || emaPriceFilter;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* FERAH VE HİZALANMIŞ ÜST BAŞLIK */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Text style={{ fontSize: 20 }}>📊</Text>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.appTitle}>AlgoTrade Mobile</Text>
              <View style={styles.versionBadge}>
                <Text style={styles.versionText}>v{CURRENT_APP_VERSION}</Text>
              </View>
            </View>
            <Text style={styles.appSubTitle}>Profesyonel Kantitatif Ticaret</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.liveBadge}
          onPress={() => {
            setTempServerUrl(serverUrl);
            setShowServerModal(true);
          }}
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>🌐 Render Canlı</Text>
        </TouchableOpacity>
      </View>

      {/* GÜNCELLEME UYARI BARI */}
      {updateInfo && updateInfo.hasUpdate && (
        <TouchableOpacity style={styles.updateNoticeBanner} onPress={() => setShowUpdateModal(true)}>
          <Text style={styles.updateNoticeText}>🚀 Yeni Güncelleme Mevcut! ({updateInfo.latestVersion}) — Yüklemek için dokunun</Text>
        </TouchableOpacity>
      )}

      {/* ÖZET İSTATİSTİK KARTLARI GRİD */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>KASA BAKİYESİ</Text>
          <Text style={styles.statValue}>${backtestResult.final_balance.toFixed(2)}</Text>
          <Text style={[styles.statSub, pnlNet >= 0 ? styles.textGreen : styles.textRed]}>
            {pnlNet >= 0 ? '+' : ''}${pnlNet.toFixed(2)} (%{backtestResult.total_return_pct})
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>WIN RATE</Text>
          <Text style={[styles.statValue, { color: '#6366f1' }]}>%{backtestResult.win_rate}</Text>
          <Text style={styles.statSub}>{backtestResult.total_trades} İşlem</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>MAX DRAWDOWN</Text>
          <Text style={[styles.statValue, styles.textRed]}>%{backtestResult.max_drawdown_pct}</Text>
          <Text style={styles.statSub}>Sermaye Riski</Text>
        </View>
      </View>

      {/* TAB NAVİGASYON BUTONLARI */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'strategy' && styles.activeTabButton]}
          onPress={() => setActiveTab('strategy')}
        >
          <Text style={[styles.tabText, activeTab === 'strategy' && styles.activeTabText]}>⚙️ Strateji</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ai' && styles.activeTabButton]}
          onPress={() => setActiveTab('ai')}
        >
          <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>🤖 AI Danışman</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>📋 Geçmiş ({backtestResult.total_trades})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* SECENEK 1: STRATEJİ & TEST FORMU */}
        {activeTab === 'strategy' && (
          <View>
            {/* PARİTE & TARİH FİLTRESİ KARTI */}
            <View style={[styles.sectionCard, { borderColor: 'rgba(245, 158, 11, 0.4)' }]}>
              <Text style={[styles.cardTitle, { color: '#f59e0b' }]}>📅 Parite & Tarih Filtresi</Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Sembol</Text>
                  <View style={styles.segmentedContainer}>
                    {['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.segmentedBtn, symbol === s && styles.segmentedBtnActive]}
                        onPress={() => setSymbol(s)}
                      >
                        <Text style={[styles.segmentedText, symbol === s && styles.segmentedTextActive]}>{s.replace('USDT', '')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Zaman Dilimi</Text>
                  <View style={styles.segmentedContainer}>
                    {['15m', '1h', '4h', '1d'].map((tf) => (
                      <TouchableOpacity
                        key={tf}
                        style={[styles.segmentedBtn, interval === tf && styles.segmentedBtnActive]}
                        onPress={() => setInterval(tf)}
                      >
                        <Text style={[styles.segmentedText, interval === tf && styles.segmentedTextActive]}>{tf}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* SADE VE TEMİZ YYYY-AA-GG TARİH GİRDİ ALANLARI */}
              <View style={[styles.inputRow, { marginTop: 8 }]}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Başlangıç Tarihi</Text>
                  <TextInput
                    style={styles.input}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-AA-GG"
                    placeholderTextColor="#6b7280"
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Bitiş Tarihi</Text>
                  <TextInput
                    style={styles.input}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-AA-GG"
                    placeholderTextColor="#6b7280"
                  />
                </View>
              </View>
            </View>

            {/* PORTFÖY & RİSK YÖNETİMİ */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>💰 Portföy & Risk Yönetimi</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Başlangıç ($)</Text>
                  <TextInput style={styles.input} value={balance} onChangeText={setBalance} keyboardType="numeric" />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>İşlem Başı (%)</Text>
                  <TextInput style={styles.input} value={posPct} onChangeText={setPosPct} keyboardType="numeric" />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Stop Loss (%)</Text>
                  <TextInput style={styles.input} value={slPct} onChangeText={setSlPct} keyboardType="numeric" />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Take Profit (%)</Text>
                  <TextInput style={styles.input} value={tpPct} onChangeText={setTpPct} keyboardType="numeric" />
                </View>
              </View>

              <View style={{ marginTop: 6 }}>
                <Text style={styles.inputLabel}>Max Eşzamanlı Pozisyon Sayısı</Text>
                <TextInput style={styles.input} value={maxPos} onChangeText={setMaxPos} keyboardType="numeric" />
              </View>
            </View>

            {/* STRATEJİ KRİTERLERİ PANELİ */}
            <View style={[styles.sectionCard, { borderColor: 'rgba(99, 102, 241, 0.5)' }]}>
              <Text style={[styles.cardTitle, { color: '#818cf8' }]}>☑️ Modüler Strateji Kriterleri</Text>

              {/* 1. RSI KRİTERİ */}
              <View style={styles.criterionBox}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>📊 RSI Kriteri</Text>
                  <Switch value={useRsi} onValueChange={setUseRsi} trackColor={{ false: '#374151', true: '#6366f1' }} />
                </View>
                {useRsi && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.subLabel}>RSI Şartı Operatörü</Text>
                    <View style={styles.segmentedContainer}>
                      <TouchableOpacity style={[styles.segmentedBtn, rsiOp === 'less' && styles.segmentedBtnActive]} onPress={() => setRsiOp('less')}>
                        <Text style={[styles.segmentedText, rsiOp === 'less' && styles.segmentedTextActive]}>Küçük (&lt;)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentedBtn, rsiOp === 'greater' && styles.segmentedBtnActive]} onPress={() => setRsiOp('greater')}>
                        <Text style={[styles.segmentedText, rsiOp === 'greater' && styles.segmentedTextActive]}>Büyük (&gt;)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentedBtn, rsiOp === 'between' && styles.segmentedBtnActive]} onPress={() => setRsiOp('between')}>
                        <Text style={[styles.segmentedText, rsiOp === 'between' && styles.segmentedTextActive]}>Arasında</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.inputRow, { marginTop: 8 }]}>
                      <View style={styles.inputCol}>
                        <Text style={styles.inputLabel}>{rsiOp === 'between' ? 'Alt Eşik' : 'Eşik Değeri'}</Text>
                        <TextInput style={styles.input} value={rsiVal1} onChangeText={setRsiVal1} keyboardType="numeric" />
                      </View>
                      {rsiOp === 'between' && (
                        <View style={styles.inputCol}>
                          <Text style={styles.inputLabel}>Üst Eşik</Text>
                          <TextInput style={styles.input} value={rsiVal2} onChangeText={setRsiVal2} keyboardType="numeric" />
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* 2. MACD KRİTERİ */}
              <View style={styles.criterionBox}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>📉 MACD Kriteri</Text>
                  <Switch value={useMacd} onValueChange={setUseMacd} trackColor={{ false: '#374151', true: '#6366f1' }} />
                </View>
                {useMacd && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.subLabel}>Kesişim Yönü</Text>
                    <View style={styles.segmentedContainer}>
                      <TouchableOpacity style={[styles.segmentedBtn, macdCross === 'bullish' && styles.segmentedBtnActive]} onPress={() => setMacdCross('bullish')}>
                        <Text style={[styles.segmentedText, macdCross === 'bullish' && styles.segmentedTextActive]}>Yukarı Kesişim</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentedBtn, macdCross === 'bearish' && styles.segmentedBtnActive]} onPress={() => setMacdCross('bearish')}>
                        <Text style={[styles.segmentedText, macdCross === 'bearish' && styles.segmentedTextActive]}>Aşağı Kesişim</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentedBtn, macdCross === 'any' && styles.segmentedBtnActive]} onPress={() => setMacdCross('any')}>
                        <Text style={[styles.segmentedText, macdCross === 'any' && styles.segmentedTextActive]}>Fark Etmez</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.subLabel, { marginTop: 8 }]}>0 Çizgisi Konumu</Text>
                    <View style={styles.segmentedContainer}>
                      <TouchableOpacity style={[styles.segmentedBtn, macdZero === 'any' && styles.segmentedBtnActive]} onPress={() => setMacdZero('any')}>
                        <Text style={[styles.segmentedText, macdZero === 'any' && styles.segmentedTextActive]}>Fark Etmez</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentedBtn, macdZero === 'below_zero' && styles.segmentedBtnActive]} onPress={() => setMacdZero('below_zero')}>
                        <Text style={[styles.segmentedText, macdZero === 'below_zero' && styles.segmentedTextActive]}>0 Altında</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentedBtn, macdZero === 'above_zero' && styles.segmentedBtnActive]} onPress={() => setMacdZero('above_zero')}>
                        <Text style={[styles.segmentedText, macdZero === 'above_zero' && styles.segmentedTextActive]}>0 Üstünde</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* 3. EMA 50 / 200 CROSS */}
              <View style={styles.criterionBox}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>🔀 EMA 50/200 Cross</Text>
                  <Switch value={useEma50200} onValueChange={setUseEma50200} trackColor={{ false: '#374151', true: '#6366f1' }} />
                </View>
                {useEma50200 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.subLabel}>Golden / Death Cross</Text>
                    <View style={styles.segmentedContainer}>
                      <TouchableOpacity style={[styles.segmentedBtn, ema50200Cross === 'bullish' && styles.segmentedBtnActive]} onPress={() => setEma50200Cross('bullish')}>
                        <Text style={[styles.segmentedText, ema50200Cross === 'bullish' && styles.segmentedTextActive]}>Golden Cross (Yukarı)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentedBtn, ema50200Cross === 'bearish' && styles.segmentedBtnActive]} onPress={() => setEma50200Cross('bearish')}>
                        <Text style={[styles.segmentedText, ema50200Cross === 'bearish' && styles.segmentedTextActive]}>Death Cross (Aşağı)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* 4. EMA 20 / 50 CROSS */}
              <View style={styles.criterionBox}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>🔀 EMA 20/50 Cross</Text>
                  <Switch value={useEma2050} onValueChange={setUseEma2050} trackColor={{ false: '#374151', true: '#6366f1' }} />
                </View>
                {useEma2050 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.subLabel}>Kesişim Yönü</Text>
                    <View style={styles.segmentedContainer}>
                      <TouchableOpacity style={[styles.segmentedBtn, ema2050Cross === 'bullish' && styles.segmentedBtnActive]} onPress={() => setEma2050Cross('bullish')}>
                        <Text style={[styles.segmentedText, ema2050Cross === 'bullish' && styles.segmentedTextActive]}>Yukarı Kesişim</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.segmentedBtn, ema2050Cross === 'bearish' && styles.segmentedBtnActive]} onPress={() => setEma2050Cross('bearish')}>
                        <Text style={[styles.segmentedText, ema2050Cross === 'bearish' && styles.segmentedTextActive]}>Aşağı Kesişim</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              {/* 5. FİYAT / EMA KONUMU */}
              <View style={styles.criterionBox}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>📍 Fiyat / EMA Konumu</Text>
                  <Switch value={useEmaPrice} onValueChange={setUseEmaPrice} trackColor={{ false: '#374151', true: '#6366f1' }} />
                </View>
                {useEmaPrice && (
                  <TouchableOpacity style={styles.selectDropdownBtn} onPress={() => setShowEmaPriceModal(true)}>
                    <Text style={styles.selectDropdownText}>{selectedEmaLabel}</Text>
                    <Text style={{ color: '#818cf8', fontSize: 12 }}>▼ Değiştir</Text>
                  </TouchableOpacity>
                )}
              </View>

            </View>

            {loading && (
              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressStatus}>{progressStatus}</Text>
                  <Text style={styles.progressPct}>%{progressPct}</Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                </View>
              </View>
            )}
          </View>
        )}

        {/* SECENEK 2: ETKİLEŞİMLİ VERİ ODAKLI AI DANIŞMANI */}
        {activeTab === 'ai' && (
          <View style={[styles.sectionCard, { borderColor: 'rgba(168, 85, 247, 0.5)' }]}>
            <Text style={[styles.cardTitle, { color: '#c084fc' }]}>🤖 DERİN KANTİTATİF AI STRATEJİ DANIŞMANI</Text>
            <Text style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12 }}>
              Stratejinizi matematiksel beklenti (Expected Value) ve veri odaklı metriklerle iyileştirin:
            </Text>

            <View style={styles.chipCloud}>
              <TouchableOpacity style={styles.actionChip} onPress={() => askAIConsult('Derin strateji iyileştirme reçetesi hazırla')}>
                <Text style={styles.actionChipText}>⚡ Derin İyileştirme Reçetesi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionChip} onPress={() => askAIConsult('Win Rate nasıl artırılır?')}>
                <Text style={styles.actionChipText}>📊 Win Rate Optimizasyonu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionChip} onPress={() => askAIConsult('Max Drawdown ve riski düşür')}>
                <Text style={styles.actionChipText}>🛡️ Risk &amp; Drawdown Telemetrisi</Text>
              </TouchableOpacity>
            </View>

            {backtestResult.ai_advice && backtestResult.ai_advice.map((advice, index) => (
              <View key={index} style={styles.adviceBox}>
                <Text style={styles.adviceText}>{advice.replace(/\*\*/g, '')}</Text>
              </View>
            ))}

            <View style={{ marginTop: 16 }}>
              <TextInput
                style={[styles.input, { height: 45, marginBottom: 10 }]}
                placeholder="Yapay Zekaya soru sorun..."
                placeholderTextColor="#6b7280"
                value={aiQuery}
                onChangeText={setAiQuery}
              />
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#a855f7' }]} onPress={() => askAIConsult(aiQuery)}>
                <Text style={styles.submitBtnText}>💬 Veri Odaklı AI Danışmana Sor</Text>
              </TouchableOpacity>
            </View>

            {aiResponse ? (
              <View style={styles.aiResultCard}>
                {aiLoading ? <ActivityIndicator color="#c084fc" /> : <Text style={styles.aiResultText}>{aiResponse.replace(/\*\*/g, '')}</Text>}
              </View>
            ) : null}
          </View>
        )}

        {/* SECENEK 3: İŞLEM GEÇMİŞİ LİSTESİ */}
        {activeTab === 'history' && (
          <View style={styles.sectionCard}>
            <Text style={styles.cardTitle}>📋 Geçmiş İşlem Kayıtları</Text>
            {backtestResult.trades && backtestResult.trades.length > 0 ? (
              backtestResult.trades.slice().reverse().map((trade, index) => (
                <View key={index} style={styles.tradeItem}>
                  <View style={styles.tradeRow}>
                    <View style={[styles.sideBadge, trade.side === 'BUY' ? styles.badgeBuy : styles.badgeSell]}>
                      <Text style={styles.badgeText}>{trade.side}</Text>
                    </View>
                    <Text style={styles.tradeDate}>{trade.entry_time ? trade.entry_time.replace('T', ' ').substring(0, 16) : 'N/A'}</Text>
                    <Text style={[styles.tradePnl, trade.pnl >= 0 ? styles.textGreen : styles.textRed]}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl} (%{trade.pnl_pct})
                    </Text>
                  </View>
                  <Text style={styles.tradeSubInfo}>
                    Giriş: ${trade.entry_price.toFixed(2)} | Çıkış: ${trade.exit_price.toFixed(2)} ({trade.exit_reason})
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>⚠️ Henüz gerçekleşmiş bir işlem bulunmuyor.</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ERGONOMİK SABİT ALT AKSİYON BARI (STRATEJİYİ TEST ET BUTONU HER ZAMAN PARMAĞINIZIN ALTINDA) */}
      {activeTab === 'strategy' && (
        <View style={styles.stickyBottomBar}>
          <TouchableOpacity style={styles.stickySubmitBtn} onPress={runBacktest} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.stickySubmitBtnText}>🚀 STRATEJİYİ TEST ET</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* RENDER SUNUCU AYARLARI MODALI */}
      <Modal visible={showServerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: '#10b981' }]}>
            <Text style={styles.modalTitle}>🌐 Canlı Sunucu (API) Ayarları</Text>
            <Text style={styles.modalSub}>Bulut sunucu adresinizi değiştirebilir veya güncelleyebilirsiniz:</Text>
            
            <TextInput
              style={[styles.input, { color: '#10b981', fontWeight: '600', marginBottom: 16 }]}
              value={tempServerUrl}
              onChangeText={setTempServerUrl}
              placeholder="https://trading-bot-33es.onrender.com"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: '#10b981' }]} onPress={saveServerUrl}>
              <Text style={styles.downloadBtnText}>💾 Kaydet ve Güncelle</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowServerModal(false)}>
              <Text style={styles.closeBtnText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* EMA FİYAT KONUMU SEÇİM MODALI */}
      <Modal visible={showEmaPriceModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderColor: '#6366f1' }]}>
            <Text style={styles.modalTitle}>📍 Fiyat / EMA Konumu Seçin</Text>
            <ScrollView style={{ maxHeight: 300, marginVertical: 10 }}>
              {emaPriceOptions.map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.modalOptionBtn, emaPriceFilter === item.value && styles.modalOptionBtnActive]}
                  onPress={() => {
                    setEmaPriceFilter(item.value);
                    setShowEmaPriceModal(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, emaPriceFilter === item.value && styles.modalOptionTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowEmaPriceModal(false)}>
              <Text style={styles.closeBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* OTOMATİK GÜNCELLEME İNDİRME MODALI */}
      {updateInfo && (
        <Modal visible={showUpdateModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>🚀 Yeni Güncelleme Mevcut!</Text>
              <Text style={styles.modalSub}>Sürüm: {updateInfo.latestVersion} (Mevcut: v{CURRENT_APP_VERSION})</Text>
              <Text style={styles.modalNotesTitle}>Neler Yeni?</Text>
              <Text style={styles.modalNotes}>{updateInfo.releaseNotes}</Text>
              <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => {
                  Linking.openURL(updateInfo.downloadUrl);
                  setShowUpdateModal(false);
                }}
              >
                <Text style={styles.downloadBtnText}>📲 Güncellemeyi İndir &amp; Yükle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowUpdateModal(false)}>
                <Text style={styles.closeBtnText}>Daha Sonra</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f19', paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  appTitle: { color: '#f3f4f6', fontSize: 16, fontWeight: '700' },
  versionBadge: { backgroundColor: 'rgba(99,102,241,0.25)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#6366f1' },
  versionText: { color: '#818cf8', fontSize: 10, fontWeight: '700' },
  appSubTitle: { color: '#9ca3af', fontSize: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveText: { color: '#10b981', fontSize: 11, fontWeight: '600' },
  updateNoticeBanner: { backgroundColor: '#a855f7', padding: 10, alignItems: 'center' },
  updateNoticeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', padding: 12, gap: 8 },
  statCard: { flex: 1, backgroundColor: 'rgba(17,24,39,0.85)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  statLabel: { color: '#9ca3af', fontSize: 9, fontWeight: '700' },
  statValue: { color: '#f3f4f6', fontSize: 16, fontWeight: '700', marginVertical: 2 },
  statSub: { fontSize: 10 },
  textGreen: { color: '#10b981' },
  textRed: { color: '#ef4444' },
  tabContainer: { flexDirection: 'row', marginHorizontal: 12, backgroundColor: 'rgba(17,24,39,0.9)', borderRadius: 10, padding: 4 },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeTabButton: { backgroundColor: '#6366f1' },
  tabText: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  activeTabText: { color: '#ffffff' },
  scrollContent: { flex: 1, padding: 12 },
  sectionCard: { backgroundColor: 'rgba(17,24,39,0.85)', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTitle: { color: '#f3f4f6', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  inputCol: { flex: 1 },
  inputLabel: { color: '#9ca3af', fontSize: 11, marginBottom: 4 },
  subLabel: { color: '#6b7280', fontSize: 10, fontWeight: '600', marginBottom: 4 },
  input: { backgroundColor: '#1f2937', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  criterionBox: { backgroundColor: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  segmentedContainer: { flexDirection: 'row', backgroundColor: '#111827', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  segmentedBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  segmentedBtnActive: { backgroundColor: '#6366f1' },
  segmentedText: { color: '#9ca3af', fontSize: 11, fontWeight: '500' },
  segmentedTextActive: { color: '#ffffff', fontWeight: '700' },
  selectDropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1f2937', padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  selectDropdownText: { color: '#f3f4f6', fontSize: 12, fontWeight: '600' },
  submitBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  stickyBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0b0f19', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  stickySubmitBtn: { backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', boxShadow: '0 4px 20px rgba(99, 102, 241, 0.5)' },
  stickySubmitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  progressBox: { marginTop: 12, backgroundColor: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressStatus: { color: '#9ca3af', fontSize: 11 },
  progressPct: { color: '#10b981', fontSize: 11, fontWeight: '700' },
  progressBarTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#10b981' },
  chipCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  actionChip: { backgroundColor: 'rgba(168, 85, 247, 0.2)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.4)' },
  actionChipText: { color: '#c084fc', fontSize: 11, fontWeight: '600' },
  adviceBox: { backgroundColor: 'rgba(255,255,255,0.03)', borderLeftWidth: 3, borderLeftColor: '#a855f7', padding: 10, borderRadius: 4, marginBottom: 8 },
  adviceText: { color: '#e5e7eb', fontSize: 12, lineHeight: 17 },
  aiResultCard: { marginTop: 12, backgroundColor: 'rgba(168, 85, 247, 0.12)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)' },
  aiResultText: { color: '#e9d5ff', fontSize: 12, lineHeight: 18 },
  tradeItem: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingVertical: 10 },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeBuy: { backgroundColor: 'rgba(16,185,129,0.2)' },
  badgeSell: { backgroundColor: 'rgba(239,68,68,0.2)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  tradeDate: { color: '#9ca3af', fontSize: 11 },
  tradePnl: { fontSize: 12, fontWeight: '700' },
  tradeSubInfo: { color: '#6b7280', fontSize: 11, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111827', width: '100%', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#a855f7' },
  modalTitle: { color: '#f3f4f6', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  modalSub: { color: '#9ca3af', fontSize: 12, marginBottom: 14 },
  modalNotesTitle: { color: '#c084fc', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  modalNotes: { color: '#e5e7eb', fontSize: 12, marginBottom: 20, lineHeight: 18 },
  modalOptionBtn: { padding: 12, borderRadius: 8, backgroundColor: '#1f2937', marginBottom: 6 },
  modalOptionBtnActive: { backgroundColor: '#6366f1' },
  modalOptionText: { color: '#9ca3af', fontSize: 13 },
  modalOptionTextActive: { color: '#ffffff', fontWeight: '700' },
  downloadBtn: { backgroundColor: '#a855f7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  downloadBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  closeBtn: { paddingVertical: 8, alignItems: 'center', marginTop: 6 },
  closeBtnText: { color: '#9ca3af', fontSize: 13 }
});
