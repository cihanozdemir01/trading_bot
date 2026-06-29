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

  // Sunucu (Backend) Bağlantı Adresi
  const [serverUrl, setServerUrl] = useState('http://10.0.2.2:8000'); // Gerçek telefonlar için örn: http://192.168.1.X:8000

  // Güncelleme Modal & Durumları
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Strateji & Risk Kriterleri
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1h');
  const [balance, setBalance] = useState('1000');
  const [posPct, setPosPct] = useState('10');
  const [maxPos, setMaxPos] = useState('3');
  const [slPct, setSlPct] = useState('1.5');
  const [tpPct, setTpPct] = useState('3.0');

  const [useRsi, setUseRsi] = useState(true);
  const [rsiOp, setRsiOp] = useState('less');
  const [rsiVal1, setRsiVal1] = useState('35');

  const [useMacd, setUseMacd] = useState(true);
  const [macdCross, setMacdCross] = useState('bullish');

  const [useEmaPrice, setUseEmaPrice] = useState(true);
  const [emaPriceFilter, setEmaPriceFilter] = useState('above_ema50');

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
      url += `&initial_balance=${balance}&position_pct=${posPct}&max_open_positions=${maxPos}`;
      url += `&use_rsi=${useRsi}&use_macd=${useMacd}&use_ema_50_200=false&use_ema_price=${useEmaPrice}`;
      url += `&rsi_op=${rsiOp}&rsi_val1=${rsiVal1}&rsi_val2=70`;
      url += `&macd_cross=${macdCross}&macd_zero=any`;
      url += `&ema_50_200_cross=bullish&ema_price_filter=${emaPriceFilter}&sl_pct=${slPct}&tp_pct=${tpPct}`;

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
        `Backend sunucusuna bağlanılamadı (${serverUrl}).\n\n💡 İPUCU: Bilgisayarınızın yerel IP adresini (Örn: http://192.168.1.35:8000) Sunucu Adresi kutusuna yazın.\n\nHata: ` + error.message
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
    setAiResponse('⏳ Yapay Zeka stratejinizi analiz ediyor...');

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

  const pnlNet = backtestResult.final_balance - backtestResult.initial_balance;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* ÜST BAŞLIK & VERSİYON */}
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
            <Text style={styles.appSubTitle}>Profesyonel Ticaret & Auto-Updater</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.liveBadge} onPress={checkUpdates}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>GitHub Canlı</Text>
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

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* SECENEK 1: STRATEJİ & TEST FORMU */}
        {activeTab === 'strategy' && (
          <View>
            {/* SUNUCU ADRESİ AYAR KARTI */}
            <View style={[styles.sectionCard, { borderColor: 'rgba(16, 185, 129, 0.4)' }]}>
              <Text style={[styles.cardTitle, { color: '#10b981', fontSize: 13 }]}>🌐 Python Sunucu Bağlantı Adresi (API URL)</Text>
              <TextInput
                style={[styles.input, { color: '#10b981', fontWeight: '600' }]}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="Örn: http://192.168.1.35:8000"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={{ color: '#9ca3af', fontSize: 10, marginTop: 4 }}>
                * Gerçek telefonlar bilgisayarın IP adresini kullanmalıdır (Örn: http://192.168.1.X:8000)
              </Text>
            </View>

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
            </View>

            <View style={[styles.sectionCard, { borderColor: 'rgba(99, 102, 241, 0.4)' }]}>
              <Text style={[styles.cardTitle, { color: '#818cf8' }]}>☑️ Modüler Strateji Kriterleri</Text>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>📊 RSI Kriteri</Text>
                <Switch value={useRsi} onValueChange={setUseRsi} trackColor={{ false: '#374151', true: '#6366f1' }} />
              </View>
              {useRsi && (
                <View style={styles.inputRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>RSI Şartı</Text>
                    <View style={styles.chipRow}>
                      <TouchableOpacity style={[styles.miniChip, rsiOp === 'less' && styles.activeMiniChip]} onPress={() => setRsiOp('less')}>
                        <Text style={styles.chipText}>Küçük (&lt;)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.miniChip, rsiOp === 'greater' && styles.activeMiniChip]} onPress={() => setRsiOp('greater')}>
                        <Text style={styles.chipText}>Büyük (&gt;)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.inputLabel}>Eşik Değeri</Text>
                    <TextInput style={styles.input} value={rsiVal1} onChangeText={setRsiVal1} keyboardType="numeric" />
                  </View>
                </View>
              )}

              <View style={[styles.switchRow, { marginTop: 14 }]}>
                <Text style={styles.switchLabel}>📉 MACD Kriteri</Text>
                <Switch value={useMacd} onValueChange={setUseMacd} trackColor={{ false: '#374151', true: '#6366f1' }} />
              </View>

              <View style={[styles.switchRow, { marginTop: 14 }]}>
                <Text style={styles.switchLabel}>📍 Fiyat &gt; EMA 50 (Trend)</Text>
                <Switch value={useEmaPrice} onValueChange={setUseEmaPrice} trackColor={{ false: '#374151', true: '#6366f1' }} />
              </View>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={runBacktest} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>🚀 Stratejiyi Test Et</Text>
              )}
            </TouchableOpacity>

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

        {/* SECENEK 2: ETKİLEŞİMLİ AI DANIŞMANI */}
        {activeTab === 'ai' && (
          <View style={[styles.sectionCard, { borderColor: 'rgba(168, 85, 247, 0.5)' }]}>
            <Text style={[styles.cardTitle, { color: '#c084fc' }]}>🤖 ETKİLEŞİMLİ AI STRATEJİ DANIŞMANI</Text>

            <Text style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
              Stratejinizi daha kârlı hale getirmek için yapay zekadan anında öneriler alın:
            </Text>

            <View style={styles.chipCloud}>
              <TouchableOpacity style={styles.actionChip} onPress={() => askAIConsult('Derin strateji iyileştirme reçetesi hazırla')}>
                <Text style={styles.actionChipText}>⚡ Stratejiyi İyileştir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionChip} onPress={() => askAIConsult('Win Rate nasıl artırılır?')}>
                <Text style={styles.actionChipText}>📊 Win Rate Yükselt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionChip} onPress={() => askAIConsult('Max Drawdown ve riski düşür')}>
                <Text style={styles.actionChipText}>🛡️ Riski Düşür</Text>
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
                <Text style={styles.submitBtnText}>💬 AI Danışmana Sor</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  appTitle: { color: '#f3f4f6', fontSize: 17, fontWeight: '700' },
  versionBadge: { backgroundColor: 'rgba(99,102,241,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#6366f1' },
  versionText: { color: '#818cf8', fontSize: 10, fontWeight: '700' },
  appSubTitle: { color: '#9ca3af', fontSize: 10 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
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
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputCol: { flex: 1 },
  inputLabel: { color: '#9ca3af', fontSize: 11, marginBottom: 4 },
  input: { backgroundColor: '#1f2937', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 6 },
  miniChip: { backgroundColor: '#374151', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  activeMiniChip: { backgroundColor: '#6366f1' },
  chipText: { color: '#fff', fontSize: 11 },
  submitBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
  modalTitle: { color: '#f3f4f6', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub: { color: '#9ca3af', fontSize: 12, marginBottom: 14 },
  modalNotesTitle: { color: '#c084fc', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  modalNotes: { color: '#e5e7eb', fontSize: 12, marginBottom: 20, lineHeight: 18 },
  downloadBtn: { backgroundColor: '#a855f7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  downloadBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  closeBtn: { paddingVertical: 8, alignItems: 'center' },
  closeBtnText: { color: '#9ca3af', fontSize: 13 }
});
