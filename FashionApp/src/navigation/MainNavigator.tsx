import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

// Tab screens
import { HomeScreen }      from '../screens/HomeScreen';
import { SearchScreen }    from '../screens/SearchScreen';
import { RecommendScreen } from '../screens/RecommendScreen';
import { ChatListScreen }  from '../screens/ChatListScreen';
import { ProfileScreen }   from '../screens/ProfileScreen';

// Stack screens
import { FeedScreen }          from '../screens/FeedScreen';
import { StoryViewerScreen }   from '../screens/StoryViewerScreen';
import { CreatePostScreen }    from '../screens/CreatePostScreen';
import { StoryCreateScreen }   from '../screens/StoryCreateScreen';
import { UserProfileScreen }   from '../screens/UserProfileScreen';
import { ChatScreen }          from '../screens/ChatScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { TryOnScreen }         from '../screens/TryOnScreen';
import { BrandShopScreen }       from '../screens/BrandShopScreen';
import { BrandPartnerScreen }    from '../screens/BrandPartnerScreen';
import { ClothingDetailScreen }  from '../screens/ClothingDetailScreen';
import { WishlistScreen }        from '../screens/WishlistScreen';
import { HistoryScreen }         from '../screens/HistoryScreen';
import { FavoritesScreen }     from '../screens/FavoritesScreen';
import { FollowersListScreen } from '../screens/FollowersListScreen';
import { EditProfileScreen }   from '../screens/EditProfileScreen';
import { VerifyEmailScreen }   from '../screens/auth/VerifyEmailScreen';
import { SettingsScreen }      from '../screens/SettingsScreen';
import { PostViewerScreen }    from '../screens/PostViewerScreen';
import { NewChatScreen }       from '../screens/NewChatScreen';
import { PostDetailScreen }    from '../screens/PostDetailScreen';

import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

// ── Tab param list ────────────────────────────────────────────────────────────
export type MainTabParamList = {
  Home:      undefined;
  Wardrobe:  undefined;
  TryOnTab:  undefined;
  Discover:  undefined;
  Profile:   undefined;
  Chats:     undefined;
};

// ── Root stack param list ─────────────────────────────────────────────────────
export type RootStackParamList = {
  Tabs:          undefined;
  Feed:          undefined;
  StoryViewer:   { groups: any[]; startUserId: number };
  CreatePost:    { imageUri: string };
  CreateStory:   { imageUri: string; postId?: number; postAuthorName?: string; postAuthorAvatar?: string | null; postCaption?: string };
  UserProfile:   { userId: number };
  Chat:          { partnerId: number; partnerName: string; partnerAvatar: string | null };
  Notifications: undefined;
  TryOn:         {
    selectedOutfit?: any;
    clothesImageUrl?: string; topId?: string; topTitle?: string;
    bottomImageUrl?: string; bottomId?: string; bottomTitle?: string;
    forSlot?: 'top' | 'bottom';
  } | undefined;
  BrandShop:      { forSlot?: 'top' | 'bottom' } | undefined;
  BrandPartner:   undefined;
  ClothingDetail: { product: any; forSlot?: 'top' | 'bottom' };
  Wishlist:       undefined;
  History:        undefined;
  Favorites:     undefined;
  FollowersList: { userId: number; type: 'followers' | 'following'; name: string };
  EditProfile:   undefined;
  VerifyEmail:   { userId: number; email: string };
  Recommend:     { prompt?: string } | undefined;
  Settings:      undefined;
  PostViewer:    { posts: any[]; startIndex: number };
  PostDetail:    { postId: number };
  NewChat:       undefined;
};

const Tab   = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_TABS = 5;
const TAB_WIDTH = SCREEN_WIDTH / NUM_TABS;

// This app's job is virtual try-on, not a photo feed — so the bar is built
// around that: a Wardrobe of the user's own AI looks, and a center button
// that drops straight into the try-on camera/upload flow (no sheet, no
// picking between "post" and "story" first). Discover leads with AI style
// shortcuts, not a people-search box. Messaging still exists, just tucked
// behind an icon on Home instead of claiming a whole tab.
const TABS = [
  { name: 'Home',     icon: 'home-outline',    iconFocused: 'home',    label: 'Home',     create: false },
  { name: 'Wardrobe', icon: 'shirt-outline',   iconFocused: 'shirt',   label: 'Wardrobe', create: false },
  { name: 'TryOnTab', icon: 'camera',          iconFocused: 'camera',  label: '',         create: true  },
  { name: 'Discover', icon: 'compass-outline', iconFocused: 'compass', label: 'Discover', create: false },
  { name: 'Profile',  icon: 'person-outline',  iconFocused: 'person',  label: 'Profile',  create: false },
];

// ── Tab item ──────────────────────────────────────────────────────────────────
const TabItem: React.FC<{
  icon: string; iconFocused: string; label: string; focused: boolean;
  isCreate?: boolean; badge?: number; onPress: () => void;
}> = ({ icon, iconFocused, label, focused, isCreate, badge, onPress }) => {
  const { themeColors: c } = useTheme();
  const tabStyles = React.useMemo(() => makeTabStyles(c), [c]);
  const scale        = useSharedValue(focused ? 1 : 0.85);
  const labelOpacity = useSharedValue(focused ? 1 : 0.5);

  useEffect(() => {
    scale.value        = withSpring(focused ? 1 : 0.85, { damping: 14, stiffness: 200 });
    labelOpacity.value = withTiming(focused ? 1 : 0.5, { duration: 200 });
  }, [focused]);

  const iconStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  if (isCreate) {
    return (
      <Pressable onPress={onPress} style={tabStyles.item}>
        <LinearGradient colors={[c.primaryLight, c.primary]} style={tabStyles.createBtn}>
          <Ionicons name="camera" size={24} color={c.white} />
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={tabStyles.item}>
      <Animated.View style={[tabStyles.iconWrapper, iconStyle]}>
        {focused ? (
          <LinearGradient colors={[c.primaryLight, c.primary]} style={tabStyles.iconBg}>
            <Ionicons name={iconFocused as any} size={18} color={c.white} />
          </LinearGradient>
        ) : (
          <View style={tabStyles.iconBgInactive}>
            <Ionicons name={icon as any} size={18} color={c.textMuted} />
          </View>
        )}
        {!!badge && badge > 0 && (
          <View style={tabStyles.badge}>
            <Text style={tabStyles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </Animated.View>
      <Animated.Text style={[tabStyles.label, focused && tabStyles.labelFocused, labelStyle]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
};

// ── Animated tab bar ──────────────────────────────────────────────────────────
const AnimatedTabBar: React.FC<BottomTabBarProps & { onCreatePress: () => void }> = ({ state, navigation: tabNavigation, onCreatePress }) => {
  const { themeColors: c } = useTheme();
  const tabStyles = React.useMemo(() => makeTabStyles(c), [c]);
  const realIndex = state.index === 2 ? -1 : state.index;
  const indicatorX = useSharedValue(realIndex >= 0 ? realIndex * TAB_WIDTH + (TAB_WIDTH - 32) / 2 : -100);

  useEffect(() => {
    if (state.index !== 2) {
      indicatorX.value = withSpring(
        state.index * TAB_WIDTH + (TAB_WIDTH - 32) / 2,
        { damping: 16, stiffness: 200 },
      );
    }
  }, [state.index]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicatorX.value }] }));

  return (
    <View style={tabStyles.container}>
      <Animated.View style={[tabStyles.indicator, indicatorStyle]} />
      {TABS.map((t, i) => (
        <TabItem
          key={t.name}
          icon={t.icon}
          iconFocused={t.iconFocused}
          label={t.label}
          focused={state.index === i}
          isCreate={t.create}
          onPress={() => {
            if (t.create) { onCreatePress(); return; }
            const event = tabNavigation.emit({ type: 'tabPress', target: state.routes[i].key, canPreventDefault: true });
            if (!event.defaultPrevented) tabNavigation.navigate(t.name as any);
          }}
        />
      ))}
    </View>
  );
};

const makeTabStyles = (c: any) => StyleSheet.create({
  container: {
    flexDirection: 'row', backgroundColor: c.surface,
    borderTopWidth: 1, borderTopColor: c.border,
    paddingBottom: 20, paddingTop: 4, position: 'relative',
  },
  indicator: { position: 'absolute', top: 0, width: 32, height: 2, borderRadius: 1, backgroundColor: c.primary },
  item: { flex: 1, alignItems: 'center', paddingTop: 6, gap: 4 },
  iconWrapper: {},
  iconBg: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  iconBgInactive: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, color: c.textMuted, fontWeight: typography.fontWeightMedium as any, letterSpacing: 0.3 },
  labelFocused: { color: c.primary, fontWeight: typography.fontWeightSemiBold as any },
  createBtn: {
    width: 48, height: 48, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: c.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  badge: {
    position: 'absolute', top: -4, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: c.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: c.surface,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: c.white, lineHeight: 12 },
});

// Never actually shown — the center tab button is intercepted by
// onCreatePress and jumps straight to the root 'TryOn' stack screen instead.
const TryOnTabPlaceholder: React.FC = () => {
  const { themeColors: c } = useTheme();
  return <View style={{ flex: 1, backgroundColor: c.background }} />;
};

// ── Tab navigator ─────────────────────────────────────────────────────────────
const TabNavigator: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user } = useAuth();

  useEffect(() => {
    // Apple/Google only send the real name on the account's first-ever
    // authorization — if the backend is still holding a placeholder name
    // (e.g. a repeat Apple sign-in that didn't resend it), send the user
    // straight to Edit Profile once so they can set their real name.
    if (user?.needsNameSetup) {
      navigation.navigate('EditProfile');
    }
  }, [user?.needsNameSetup]);

  // The center button IS the product — straight into the try-on flow,
  // no sheet asking whether you meant a post or a story first.
  const handleCreatePress = () => navigation.navigate('TryOn');

  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} onCreatePress={handleCreatePress} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Wardrobe" component={HistoryScreen} />
      <Tab.Screen name="TryOnTab" component={TryOnTabPlaceholder} />
      <Tab.Screen name="Discover" component={SearchScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
      <Tab.Screen name="Chats"    component={ChatListScreen} />
    </Tab.Navigator>
  );
};

// ── Root stack ────────────────────────────────────────────────────────────────
export const MainNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs"          component={TabNavigator} />
    <Stack.Screen name="Feed"          component={FeedScreen} />
    <Stack.Screen name="StoryViewer"   component={StoryViewerScreen}   options={{ animation: 'fade' }} />
    <Stack.Screen name="CreatePost"    component={CreatePostScreen}    options={{ presentation: 'modal' }} />
    <Stack.Screen name="CreateStory"   component={StoryCreateScreen}   options={{ presentation: 'fullScreenModal' }} />
    <Stack.Screen name="Recommend"     component={RecommendScreen} />
    <Stack.Screen name="UserProfile"   component={UserProfileScreen} />
    <Stack.Screen name="Chat"          component={ChatScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="TryOn"         component={TryOnScreen} />
    <Stack.Screen name="BrandShop"      component={BrandShopScreen} />
    <Stack.Screen name="BrandPartner"   component={BrandPartnerScreen} />
    <Stack.Screen name="ClothingDetail" component={ClothingDetailScreen} />
    <Stack.Screen name="Wishlist"        component={WishlistScreen} />
    <Stack.Screen name="History"       component={HistoryScreen} />
    <Stack.Screen name="Favorites"     component={FavoritesScreen} />
    <Stack.Screen name="FollowersList" component={FollowersListScreen} />
    <Stack.Screen name="EditProfile"   component={EditProfileScreen} />
    <Stack.Screen name="VerifyEmail"   component={VerifyEmailScreen}   options={{ presentation: 'modal' }} />
    <Stack.Screen name="Settings"      component={SettingsScreen} />
    <Stack.Screen name="PostViewer"    component={PostViewerScreen} />
    <Stack.Screen name="NewChat"       component={NewChatScreen}    options={{ presentation: 'modal' }} />
    <Stack.Screen name="PostDetail"    component={PostDetailScreen} />
  </Stack.Navigator>
);
