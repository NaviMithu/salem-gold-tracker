import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  fetchGoldRates,
  getStoredGoldData,
  GoldApiResponse,
  DayRate22K,
} from '../services/goldRateService';
import {
  scheduleDaily7AMNotification,
  cancelDailyNotification,
  isDailyNotificationScheduled,
  sendTestNotificationNow,
} from '../services/notificationService';
import { GoldChart } from '../components/GoldChart';

export default function HomeScreen() {
  const [data, setData] = useState<GoldApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAll30Days, setShowAll30Days] = useState(false);

  const appState = useRef(AppState.currentState);

  // Load fresh data from the backend
  const loadRates = useCallback(async (forceRefresh = false) => {
    try {
      setErrorMessage(null);
      const result = await fetchGoldRates(forceRefresh);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch gold rates:', err);
      // Fallback to offline phone storage if backend is unreachable
      const cached = await getStoredGoldData();
      if (cached) {
        setData(cached);
        setErrorMessage('Showing saved offline rates. Check backend connection.');
      } else {
        setErrorMessage('Unable to connect to backend server. Make sure it is running.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch data on app open and when app returns to foreground
  useEffect(() => {
    loadRates(false);

    // Re-fetch whenever app comes back to foreground
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        loadRates(false);
      }
      appState.current = nextAppState;
    });

    // Check if daily 7:00 AM notification is active
    isDailyNotificationScheduled().then((isScheduled) => {
      setNotificationEnabled(isScheduled);
    });

    return () => {
      subscription.remove();
    };
  }, [loadRates]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRates(true);
  };

  // Toggle 7:00 AM notification
  const handleToggleNotification = async (enabled: boolean) => {
    const currentRate = data?.today.rate22K;

    if (enabled) {
      const scheduled = await scheduleDaily7AMNotification(currentRate);
      if (scheduled) {
        setNotificationEnabled(true);
        Alert.alert(
          '7:00 AM Alert Enabled ⏰',
          'You will receive a notification every morning at 7:00 AM with the latest Salem 22K gold rate.',
        );
      } else {
        setNotificationEnabled(false);
        Alert.alert(
          'Permission Required',
          'Please grant notification permission in your phone settings to receive the daily 7:00 AM rate alert.',
        );
      }
    } else {
      await cancelDailyNotification();
      setNotificationEnabled(false);
    }
  };

  // Test notification button
  const handleTestNotification = async () => {
    const rate = data?.today.rate22K ?? 13515;
    const sent = await sendTestNotificationNow(rate);
    if (!sent) {
      Alert.alert(
        'Permission Denied',
        'Please allow notification permissions in your phone settings to receive alerts.',
      );
    }
  };

  const rate22K = data?.today.rate22K ?? 13515;
  const sovereign22K = data?.today.sovereign22K ?? rate22K * 8; // 8 grams = 1 Sovereign (Pavan)
  const change22K = data?.today.change22K ?? -75;
  const changePercentage = data?.today.changePercentage ?? -0.55;

  const displayDate =
    data?.today.displayDate ||
    new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const historyList: DayRate22K[] = data?.history || [];
  const displayedHistory = showAll30Days ? historyList : historyList.slice(0, 10);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#F3D58A"
          colors={['#F3D58A']}
        />
      }
    >
      {/* App Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Salem Gold Tracker</Text>
          <Text style={styles.subtitle}>Salem, Tamil Nadu · 22K Ornament Gold</Text>
        </View>

        {loading && <ActivityIndicator size="small" color="#F3D58A" />}
      </View>

      {/* Offline Warning Banner if backend unreachable */}
      {errorMessage && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{errorMessage}</Text>
        </View>
      )}

      {/* Main 22K Rate Card */}
      <View style={styles.rateCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.label}>TODAY'S 22K GOLD RATE</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <Text style={styles.purityText}>22K Hallmark Gold · 1 Gram</Text>

        <View style={styles.priceRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Text style={styles.priceNumber}>
            {rate22K.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.perGramUnit}>/ gram</Text>
        </View>

        {/* 1 Sovereign (8 Grams Pavan) */}
        <View style={styles.sovereignBox}>
          <Text style={styles.sovereignLabel}>1 Sovereign (8g Pavan):</Text>
          <Text style={styles.sovereignPrice}>
            ₹{sovereign22K.toLocaleString('en-IN')}
          </Text>
        </View>

        <Text style={styles.dateText}>{displayDate}</Text>

        {/* Daily Change Badge */}
        <View style={styles.changeBox}>
          <View style={styles.changeTopRow}>
            <Text
              style={[
                styles.changeAmount,
                change22K >= 0 ? styles.positiveText : styles.negativeText,
              ]}
            >
              {change22K >= 0 ? '+' : '-'}₹{Math.abs(change22K).toLocaleString('en-IN')}
            </Text>
            <Text
              style={[
                styles.changePercent,
                change22K >= 0 ? styles.positiveText : styles.negativeText,
              ]}
            >
              ({change22K >= 0 ? '+' : ''}
              {changePercentage}%)
            </Text>
          </View>
          <Text style={styles.changeSubtext}>compared with yesterday</Text>
        </View>
      </View>

      {/* Daily 7:00 AM Notification Card */}
      <View style={styles.notificationCard}>
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIconWrap}>
            <Text style={styles.bellIcon}>🔔</Text>
          </View>
          <View style={styles.notificationTextWrap}>
            <Text style={styles.notificationTitle}>Daily 7:00 AM Alert</Text>
            <Text style={styles.notificationSubtitle}>
              Get Salem's 22K rate notified on your phone every morning
            </Text>
          </View>
          <Switch
            value={notificationEnabled}
            onValueChange={handleToggleNotification}
            trackColor={{ false: '#2D3546', true: '#F3D58A' }}
            thumbColor={notificationEnabled ? '#171B24' : '#6B7487'}
          />
        </View>

        <TouchableOpacity
          style={styles.testAlertButton}
          onPress={handleTestNotification}
          activeOpacity={0.7}
        >
          <Text style={styles.testAlertText}>Test Notification Now</Text>
        </TouchableOpacity>
      </View>

      {/* 30-Day Interactive Gold Rate Chart */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.sectionTitle}>30-Day Price Chart</Text>
            <Text style={styles.chartSubtitle}>
              Full month 22K trend in ₹ per gram
            </Text>
          </View>
          <Text style={styles.trendIcon}>📈</Text>
        </View>

        {/* Hover/Touch to show amount right on the chart */}
        <GoldChart history={historyList} />
      </View>

      {/* 30-Day Historical Table */}
      {historyList.length > 0 && (
        <View style={styles.historyCard}>
          <View style={styles.historyCardHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {showAll30Days ? 'Full 30-Day History' : 'Last 10 Days History'}
              </Text>
              <Text style={styles.chartSubtitle}>Daily 22K gold rates in Salem</Text>
            </View>

            <TouchableOpacity
              style={styles.toggleDaysBtn}
              onPress={() => setShowAll30Days((prev) => !prev)}
            >
              <Text style={styles.toggleDaysText}>
                {showAll30Days ? 'Show 10 Days' : 'View All 30 Days'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.historyTable}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Date</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                22K / Gram
              </Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                Difference
              </Text>
            </View>

            {displayedHistory.map((item, index) => {
              return (
                <View
                  key={index}
                  style={[
                    styles.tableRow,
                    index === 0 && styles.firstTableRow,
                    index === displayedHistory.length - 1 && styles.lastTableRow,
                  ]}
                >
                  <Text style={[styles.tableCellDate, { flex: 1.4 }]}>
                    {item.date}
                  </Text>
                  <Text style={[styles.tableCellPrice, { flex: 1, textAlign: 'right' }]}>
                    ₹{item.rate22K.toLocaleString('en-IN')}
                  </Text>
                  <Text
                    style={[
                      styles.tableCellChange,
                      { flex: 1, textAlign: 'right' },
                      item.change22K >= 0 ? styles.positiveText : styles.negativeText,
                    ]}
                  >
                    {item.change22K > 0
                      ? `+₹${item.change22K}`
                      : item.change22K < 0
                      ? `-₹${Math.abs(item.change22K)}`
                      : '₹0'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Footer Info */}
      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>
          Salem Gold Tracker · 22K Gold Rates via Goodreturns
        </Text>
        {data?.scrapedAt && (
          <Text style={styles.footerSubtext}>
            Sync: {new Date(data.scrapedAt).toLocaleTimeString('en-IN')}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1219',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F3D58A',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#8D96A8',
    marginTop: 4,
  },
  warningBanner: {
    backgroundColor: '#352718',
    marginHorizontal: 18,
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7A5826',
  },
  warningText: {
    color: '#F3D58A',
    fontSize: 12,
    textAlign: 'center',
  },
  rateCard: {
    backgroundColor: '#181E2B',
    marginHorizontal: 18,
    padding: 22,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: '#544426',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: '#F3D58A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2D1A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3D612B',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6FD357',
    marginRight: 5,
  },
  liveText: {
    color: '#6FD357',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  purityText: {
    color: '#9FA7B8',
    fontSize: 14,
    marginTop: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F3D58A',
    marginRight: 4,
  },
  priceNumber: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  perGramUnit: {
    color: '#9FA7B8',
    fontSize: 15,
    marginLeft: 8,
  },
  sovereignBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11151E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  sovereignLabel: {
    color: '#848C9E',
    fontSize: 12,
    fontWeight: '500',
  },
  sovereignPrice: {
    color: '#F3D58A',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  dateText: {
    color: '#848C9E',
    fontSize: 12,
    marginTop: 10,
  },
  changeBox: {
    backgroundColor: '#222B3B',
    padding: 14,
    borderRadius: 14,
    marginTop: 18,
  },
  changeTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  changeAmount: {
    fontSize: 19,
    fontWeight: '800',
  },
  changePercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  positiveText: {
    color: '#65D98B',
  },
  negativeText: {
    color: '#FF6F6F',
  },
  changeSubtext: {
    color: '#8A92A4',
    fontSize: 11,
    marginTop: 3,
  },
  notificationCard: {
    backgroundColor: '#181E2B',
    marginHorizontal: 18,
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#262F40',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#232B3B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bellIcon: {
    fontSize: 18,
  },
  notificationTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  notificationTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  notificationSubtitle: {
    color: '#848C9E',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  testAlertButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#212838',
    borderWidth: 1,
    borderColor: '#323D52',
  },
  testAlertText: {
    color: '#F3D58A',
    fontSize: 12,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#181E2B',
    marginHorizontal: 18,
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#262F40',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  chartSubtitle: {
    color: '#848C9E',
    fontSize: 12,
    marginTop: 4,
  },
  trendIcon: {
    fontSize: 22,
  },
  historyCard: {
    backgroundColor: '#181E2B',
    marginHorizontal: 18,
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#262F40',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleDaysBtn: {
    backgroundColor: '#232B3B',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#354157',
  },
  toggleDaysText: {
    color: '#F3D58A',
    fontSize: 11,
    fontWeight: '700',
  },
  historyTable: {
    marginTop: 14,
    backgroundColor: '#11151E',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1E2534',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tableHeaderCell: {
    color: '#848C9E',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A202D',
  },
  firstTableRow: {
    backgroundColor: '#151A24',
  },
  lastTableRow: {
    borderBottomWidth: 0,
  },
  tableCellDate: {
    color: '#C2C8D4',
    fontSize: 12,
    fontWeight: '500',
  },
  tableCellPrice: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tableCellChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerContainer: {
    marginTop: 24,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footerText: {
    color: '#5D6577',
    fontSize: 11,
    textAlign: 'center',
  },
  footerSubtext: {
    color: '#4B5263',
    fontSize: 10,
    marginTop: 4,
  },
});
