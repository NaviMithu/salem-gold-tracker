
import { StyleSheet, Text, View, ScrollView } from 'react-native';

export default function HomeScreen() {
  const goldRate = 13590;
  const yesterdayRate = 13520;

  const difference = goldRate - yesterdayRate;

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.appName}>Salem Gold Tracker</Text>
        <Text style={styles.subtitle}>Salem, Tamil Nadu</Text>
      </View>

      <View style={styles.rateCard}>
        <Text style={styles.label}>TODAY'S GOLD RATE</Text>
        <Text style={styles.purity}>22K Gold · Per gram</Text>

        <Text style={styles.price}>
          ₹{goldRate.toLocaleString('en-IN')}
        </Text>

        <Text style={styles.date}>{today}</Text>

        <View style={styles.changeBox}>
          <Text style={styles.change}>
            {difference >= 0 ? '+' : '-'}₹
            {Math.abs(difference).toLocaleString('en-IN')}
          </Text>
          <Text style={styles.changeLabel}>compared with yesterday</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Gold Rate History</Text>
        <Text style={styles.chartSubtitle}>
          Price in ₹ per gram
        </Text>

        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartIcon}>〽</Text>
          <Text style={styles.placeholderTitle}>
            Your gold chart will appear here
          </Text>
          <Text style={styles.placeholderText}>
            Once we save daily gold rates, you can track
            how the price changes over time.
          </Text>
        </View>
      </View>

      <Text style={styles.footer}>
        Sample data 
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10131B',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  appName: {
    fontSize: 27,
    fontWeight: 'bold',
    color: '#F3D58A',
  },
  subtitle: {
    fontSize: 14,
    color: '#A7ACBA',
    marginTop: 6,
  },
  rateCard: {
    backgroundColor: '#202532',
    marginHorizontal: 18,
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#665633',
  },
  label: {
    color: '#F3D58A',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  purity: {
    color: '#C0C5D0',
    fontSize: 14,
    marginTop: 12,
  },
  price: {
    color: '#F3D58A',
    fontSize: 43,
    fontWeight: 'bold',
    marginTop: 8,
  },
  date: {
    color: '#A7ACBA',
    fontSize: 13,
    marginTop: 8,
  },
  changeBox: {
    backgroundColor: '#303746',
    padding: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  change: {
    color: '#8BE0A5',
    fontSize: 20,
    fontWeight: 'bold',
  },
  changeLabel: {
    color: '#C0C5D0',
    fontSize: 12,
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: '#202532',
    marginHorizontal: 18,
    marginTop: 22,
    padding: 20,
    borderRadius: 22,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chartSubtitle: {
    color: '#A7ACBA',
    fontSize: 13,
    marginTop: 6,
  },
  chartPlaceholder: {
    minHeight: 210,
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#414858',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  chartIcon: {
    color: '#F3D58A',
    fontSize: 42,
  },
  placeholderTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  placeholderText: {
    color: '#A7ACBA',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  footer: {
    color: '#777F90',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 32,
  },
});
