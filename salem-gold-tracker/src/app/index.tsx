import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import {
  fetchGoldRates,
  getStoredGoldData,
  GoldApiResponse,
  HistoricalRateItem,
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
  const [selectedPurity, setSelectedPurity] = useState<'22K' | '24K'>('22K');
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load initial data and check notification state
  const loadRates = useCallback(async (forceRefresh = false) => {
    try {
      setErrorMessage(null);
      const result = await fetchGoldRates(forceRefresh);
      setData(result);
    } catch (err) {
      console.error('Failed to load gold rates:', err);
      // Fallback to local storage
      const cached = await getStoredGoldData();
      if (cached) {
        setData(cached);
        setErrorMessage('Displaying offline saved rate. Check server connection.');
      } else {
        setErrorMessage('Unable to connect to gold rate server. Please ensure backend is running.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRates();

    // Check if notification is already scheduled
    isDailyNotificationScheduled().then((isScheduled) => {
      setNotificationEnabled(isScheduled);
    });
  }, [loadRates]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRates(true);
  };

  // Toggle 7:00 AM notification
  const handleToggleNotification = async (enabled: boolean) => {
    const currentRate =
      selectedPurity === '22K'
        ? data?.today.rate22K
        : data?.today.rate24K;

    if (enabled) {
      const scheduled = await scheduleDaily7AMNotification(currentRate);
      if (scheduled) {
        setNotificationEnabled(true);
        Alert.alert(
          '7:00 AM Alert Enabled',
          'You will receive a notification every day at 7:00 AM with the latest Salem gold rate.',
        );
      } else {
        setNotificationEnabled(false);
        Alert.alert(
          'Permission Needed',
          'Please enable notifications in your phone settings to receive the daily 7:00 AM rate alert.',
        );
      }
    } else {
      await cancelDailyNotification();
      setNotificationEnabled(false);
    }
  };

  // Test notification button
  const handleTestNotification = async () => {
    const rate =
      selectedPurity === '22K'
        ? data?.today.rate22K ?? 13515
        : data?.today.rate24K ?? 14744;

    const sent = await sendTestNotificationNow(rate);
    if (!sent) {
      Alert.alert(
        'Permission Denied',
        'Please grant notification permission in your phone settings to receive alerts.',
      );
    }
  };

  // Extract active price and changes based on chosen purity
  const is22K = selectedPurity === '22K';
  const pricePerGram = is22K
    ? data?.today.rate22K ?? 13515
    : data?.today.rate24K ?? 14744;

  const sovereignPrice = pricePerGram * 8; // 8 grams = 1 Sovereign (Pavan)

  const change = is22K
    ? data?.today.change22K ?? -75
    : (data?.history[0]?.change24K ?? -82);

  const changePercentage =
    data?.today.yesterdayRate22K && is22K
      ? data.today.changePercentage
      : Number(((change / (pricePerGram - change)) * 100).toFixed(2));

  const displayDate =
    data?.today.displayDate ||
    new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const historyList: HistoricalRateItem[] = data?.history || [];

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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>Salem Gold Tracker</Text>
          <Text style={styles.subtitle}>Salem, Tamil Nadu · Live Market Rates</Text>
        </View>

        {loading && <ActivityIndicator size="small" color="#F3D58A" />}
      </View>

      {/* Offline/Error Notice */}
      {errorMessage && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>{errorMessage}</Text>
        </View>
      )}

      {/* Purity Switcher Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, is22K && styles.activeTabButton]}
          onPress={() => setSelectedPurity('22K')}
        >
          <Text style={[styles.tabText, is22K && styles.activeTabText]}>
            22K Hallmark Gold
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, !is22K && styles.activeTabButton]}
          onPress={() => setSelectedPurity('24K')}
        >
          <Text style={[styles.tabText, !is22K && styles.activeTabText]}>
            24K Pure Gold
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Rate Card */}
      <View style={styles.rateCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.label}>TODAY'S GOLD RATE</Text>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <Text style={styles.purityText}>
          {selectedPurity} Gold · 1 Gram
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Text style={styles.priceNumber}>
            {pricePerGram.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.perGramUnit}>/ gram</Text>
        </View>

        {/* 1 Sovereign (8 Grams) Calculation */}
        <View style={styles.sovereignBox}>
          <Text style={styles.sovereignLabel}>1 Sovereign (8g Pavan):</Text>
          <Text style={styles.sovereignPrice}>
            ₹{sovereignPrice.toLocaleString('en-IN')}
          </Text>
        </View>

        <Text style={styles.dateText}>{displayDate}</Text>

        {/* Daily Change Badge */}
        <View style={styles.changeBox}>
          <View style={styles.changeTopRow}>
            <Text
              style={[
                styles.changeAmount,
                change >= 0 ? styles.positiveText : styles.negativeText,
              ]}
            >
              {change >= 0 ? '+' : '-'}₹{Math.abs(change).toLocaleString('en-IN')}
            </Text>
            <Text
              style={[
                styles.changePercent,
                change >= 0 ? styles.positiveText : styles.negativeText,
              ]}
            >
              ({change >= 0 ? '+' : ''}
              {changePercentage}%)
            </Text>
          </View>
          <Text style={styles.changeSubtext}>compared with yesterday</Text>
        </View>
      </View>

      {/* 7:00 AM Daily Notification Card */}
      <View style={styles.notificationCard}>
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIconWrap}>
            <Text style={styles.bellIcon}>🔔</Text>
          </View>
          <View style={styles.notificationTextWrap}>
            <Text style={styles.notificationTitle}>Daily 7:00 AM Notification</Text>
            <Text style={styles.notificationSubtitle}>
              Get Salem's gold rate alert on your phone every morning
            </Text>
          </View>
          <Switch
            value={notificationEnabled}
            onValueChange={handleToggleNotification}
            trackColor={{ false: '#32394A', true: '#F3D58A' }}
            thumbColor={notificationEnabled ? '#1A1F2B' : '#778095'}
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

      {/* Interactive History Chart Card */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.sectionTitle}>Price Trend Chart</Text>
            <Text style={styles.chartSubtitle}>
              Salem {selectedPurity} rate in ₹ per gram
            </Text>
          </View>
          <Text style={styles.trendIcon}>📈</Text>
        </View>

        <GoldChart history={historyList} purity={selectedPurity} />
      </View>

      {/* 10-Day Historical Table */}
      {historyList.length > 0 && (
        <View style={styles.historyCard}>
          <Text style={styles.sectionTitle}>Recent Price History</Text>
          <Text style={styles.chartSubtitle}>Past days market rates in Salem</Text>

          <View style={styles.historyTable}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Date</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                {selectedPurity} / g
              </Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>
                Change
              </Text>
            </View>

            {historyList.map((item, index) => {
              const rate = is22K ? item.rate22K : item.rate24K;
              const chg = is22K ? item.change22K : item.change24K;
              return (
                <View
                  key={index}
                  style={[
                    styles.tableRow,
                    index === 0 && styles.firstTableRow,
                    index === historyList.length - 1 && styles.lastTableRow,
                  ]}
                >
                  <Text style={[styles.tableCellDate, { flex: 1.4 }]}>
                    {item.date}
                  </Text>
                  <Text style={[styles.tableCellPrice, { flex: 1, textAlign: 'right' }]}>
                    ₹{rate.toLocaleString('en-IN')}
                  </Text>
                  <Text
                    style={[
                      styles.tableCellChange,
                      { flex: 1, textAlign: 'right' },
                      chg >= 0 ? styles.positiveText : styles.negativeText,
                    ]}
                  >
                    {chg > 0 ? `+₹${chg}` : chg < 0 ? `-₹${Math.abs(chg)}` : '₹0'}
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
          Salem Gold Tracker · Live Data via Goodreturns
        </Text>
        {data?.scrapedAt && (
          <Text style={styles.footerSubtext}>
            Updated: {new Date(data.scrapedAt).toLocaleTimeString('en-IN')}
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
    backgroundColor: '#382A1B',
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 16,
    backgroundColor: '#1A202C',
    borderRadius: 14,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabButton: {
    backgroundColor: '#283144',
  },
  tabText: {
    color: '#7E8799',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#F3D58A',
    fontWeight: '700',
  },
  rateCard: {
    backgroundColor: '#1A202C',
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
    backgroundColor: '#272F22',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4E7238',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#72D65B',
    marginRight: 5,
  },
  liveText: {
    color: '#72D65B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  purityText: {
    color: '#A0A8B8',
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
    color: '#A0A8B8',
    fontSize: 15,
    marginLeft: 8,
  },
  sovereignBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141822',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  sovereignLabel: {
    color: '#8A92A4',
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
    color: '#8A92A4',
    fontSize: 12,
    marginTop: 10,
  },
  changeBox: {
    backgroundColor: '#262F40',
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
    color: '#8D96A8',
    fontSize: 11,
    marginTop: 3,
  },
  notificationCard: {
    backgroundColor: '#1A202C',
    marginHorizontal: 18,
    marginTop: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2A3346',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#272F3E',
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
    color: '#8A92A4',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  testAlertButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#242C3D',
    borderWidth: 1,
    borderColor: '#37435C',
  },
  testAlertText: {
    color: '#F3D58A',
    fontSize: 12,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#1A202C',
    marginHorizontal: 18,
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A3346',
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
    color: '#8A92A4',
    fontSize: 12,
    marginTop: 4,
  },
  trendIcon: {
    fontSize: 22,
  },
  historyCard: {
    backgroundColor: '#1A202C',
    marginHorizontal: 18,
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2A3346',
  },
  historyTable: {
    marginTop: 14,
    backgroundColor: '#141822',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#222938',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  tableHeaderCell: {
    color: '#8A92A4',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2433',
  },
  firstTableRow: {
    backgroundColor: '#181E2B',
  },
  lastTableRow: {
    borderBottomWidth: 0,
  },
  tableCellDate: {
    color: '#C6CCD8',
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
    color: '#636C80',
    fontSize: 11,
    textAlign: 'center',
  },
  footerSubtext: {
    color: '#515869',
    fontSize: 10,
    marginTop: 4,
  },
});
