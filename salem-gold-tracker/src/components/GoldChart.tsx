import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import { HistoricalRateItem } from '../services/goldRateService';

interface GoldChartProps {
  history: HistoricalRateItem[];
  purity: '22K' | '24K';
}

export const GoldChart: React.FC<GoldChartProps> = ({ history, purity }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!history || history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No historical price data available yet.</Text>
      </View>
    );
  }

  // Reverse history so oldest is on the left and newest is on the right
  const chartData = [...history].reverse();

  const prices = chartData.map((item) =>
    purity === '22K' ? item.rate22K : item.rate24K,
  );

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 100;

  // Layout dimensions
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 76; // Card margins + padding
  const chartHeight = 190;
  const paddingVertical = 25;
  const paddingHorizontal = 18;

  const innerWidth = chartWidth - paddingHorizontal * 2;
  const innerHeight = chartHeight - paddingVertical * 2;

  // Calculate coordinates for each point
  const points = chartData.map((item, index) => {
    const price = purity === '22K' ? item.rate22K : item.rate24K;
    const x = paddingHorizontal + (index / (chartData.length - 1 || 1)) * innerWidth;
    const y =
      paddingVertical +
      innerHeight -
      ((price - minPrice) / priceRange) * innerHeight;

    return { x, y, price, item, index };
  });

  // Build SVG path
  const linePath = points.reduce((acc, point, index) => {
    return index === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
  }, '');

  // Build gradient area path (closed at the bottom)
  const bottomY = chartHeight - 5;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`;

  // Selected or latest active point
  const activePoint =
    selectedIndex !== null ? points[selectedIndex] : points[points.length - 1];

  return (
    <View style={styles.container}>
      {/* Active Point Detail Banner */}
      <View style={styles.activeDetailBar}>
        <View>
          <Text style={styles.activeDate}>
            {activePoint?.item.date || 'Latest'}
          </Text>
          <Text style={styles.activePrice}>
            ₹{activePoint?.price.toLocaleString('en-IN')}{' '}
            <Text style={styles.perGramText}>/ gram</Text>
          </Text>
        </View>

        <View style={styles.statsSummary}>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>HIGH</Text>
            <Text style={styles.statValue}>₹{maxPrice.toLocaleString('en-IN')}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statLabel}>LOW</Text>
            <Text style={styles.statValue}>₹{minPrice.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>

      {/* SVG Chart */}
      <View style={styles.svgWrapper}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="goldGlow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#F3D58A" stopOpacity="0.45" />
              <Stop offset="75%" stopColor="#F3D58A" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#F3D58A" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Grid lines */}
          <Line
            x1={paddingHorizontal}
            y1={paddingVertical}
            x2={chartWidth - paddingHorizontal}
            y2={paddingVertical}
            stroke="#2B3242"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <Line
            x1={paddingHorizontal}
            y1={paddingVertical + innerHeight / 2}
            x2={chartWidth - paddingHorizontal}
            y2={paddingVertical + innerHeight / 2}
            stroke="#2B3242"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <Line
            x1={paddingHorizontal}
            y1={bottomY}
            x2={chartWidth - paddingHorizontal}
            y2={bottomY}
            stroke="#2B3242"
            strokeWidth="1"
          />

          {/* Gradient Area Fill */}
          <Path d={areaPath} fill="url(#goldGlow)" />

          {/* Golden Trend Line */}
          <Path
            d={linePath}
            fill="none"
            stroke="#F3D58A"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((p, i) => {
            const isSelected = activePoint?.index === i;
            return (
              <React.Fragment key={i}>
                {isSelected && (
                  <>
                    {/* Vertical guideline */}
                    <Line
                      x1={p.x}
                      y1={paddingVertical}
                      x2={p.x}
                      y2={bottomY}
                      stroke="#F3D58A"
                      strokeDasharray="3 3"
                      strokeWidth="1.2"
                      opacity={0.6}
                    />
                    {/* Pulsing outer ring */}
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r="9"
                      fill="#F3D58A"
                      fillOpacity="0.25"
                    />
                  </>
                )}
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? '5.5' : '3.5'}
                  fill={isSelected ? '#FFFFFF' : '#F3D58A'}
                  stroke="#1E2330"
                  strokeWidth="2"
                />
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Transparent touch targets over each point */}
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.touchOverlay}>
            {points.map((p, i) => (
              <TouchableOpacity
                key={i}
                style={styles.touchColumn}
                activeOpacity={0.7}
                onPress={() => setSelectedIndex(i)}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Date Labels under chart */}
      <View style={styles.labelsRow}>
        {points
          .filter((_, i) => i === 0 || i === Math.floor(points.length / 2) || i === points.length - 1)
          .map((p, i) => (
            <Text key={i} style={styles.dateLabel}>
              {p.item.shortDate || p.item.date}
            </Text>
          ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#8A92A6',
    fontSize: 14,
  },
  activeDetailBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  activeDate: {
    color: '#8A92A6',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  activePrice: {
    color: '#F3D58A',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 2,
  },
  perGramText: {
    color: '#A0A7B8',
    fontSize: 13,
    fontWeight: 'normal',
  },
  statsSummary: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    backgroundColor: '#161A24',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3546',
    alignItems: 'center',
  },
  statLabel: {
    color: '#7E8699',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statValue: {
    color: '#E1E5EE',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#161A24',
    paddingVertical: 4,
  },
  touchOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  touchColumn: {
    flex: 1,
    height: '100%',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginTop: 8,
  },
  dateLabel: {
    color: '#778095',
    fontSize: 11,
    fontWeight: '500',
  },
});
