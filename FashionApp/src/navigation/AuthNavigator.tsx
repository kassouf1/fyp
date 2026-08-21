import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { VerifyEmailScreen } from '../screens/auth/VerifyEmailScreen';
import { CompleteProfileScreen } from '../screens/auth/CompleteProfileScreen';
import { AuthResponse } from '../api/auth';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { userId: number; email: string };
  CompleteProfile: { pendingUser: AuthResponse };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
    <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
  </Stack.Navigator>
);
