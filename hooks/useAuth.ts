import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  linkWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { firebaseAuth } from '@/utils/firebase';
import { useAuthRequest, makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
};


function generateNonce(length = 32): string {
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)];
  }
  return result;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [_request, _response, promptGoogleSignIn] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
      redirectUri: makeRedirectUri({ scheme: 'kongue' }),
      scopes: ['openid', 'profile', 'email'],
      responseType: 'token',
      extraParams: { access_type: 'online' },
    },
    GOOGLE_DISCOVERY
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      if (!firebaseUser) {
        await signInAnonymously(firebaseAuth);
      } else {
        setUser(firebaseUser);
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    const result = await promptGoogleSignIn();
    if (result.type === 'cancel' || result.type === 'dismiss') {
      const err = new Error('cancelled') as any;
      err.code = 'SIGN_IN_CANCELLED';
      throw err;
    }
    if (result.type !== 'success') return;
    const accessToken = result.params?.access_token;
    if (!accessToken) throw new Error('No access token from Google');
    const credential = GoogleAuthProvider.credential(null, accessToken);
    const currentUser = firebaseAuth.currentUser;
    if (currentUser?.isAnonymous) {
      await linkWithCredential(currentUser, credential).catch(() =>
        signInWithCredential(firebaseAuth, credential)
      );
    } else {
      await signInWithCredential(firebaseAuth, credential);
    }
  };

  const signInWithApple = async (): Promise<void> => {
    const rawNonce = generateNonce();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const appleResponse = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!appleResponse.identityToken) throw new Error('No identity token from Apple');
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: appleResponse.identityToken,
      rawNonce,
    });
    const currentUser = firebaseAuth.currentUser;
    if (currentUser?.isAnonymous) {
      await linkWithCredential(currentUser, credential);
    } else {
      await signInWithCredential(firebaseAuth, credential);
    }
  };

  const signOut = async (): Promise<void> => {
    await firebaseSignOut(firebaseAuth);
    await signInAnonymously(firebaseAuth);
  };

  const isAppleAvailable = Platform.OS === 'ios';
  const isSignedIn = !!user && !user.isAnonymous;

  return { user, isLoading, isSignedIn, isAppleAvailable, signInWithGoogle, signInWithApple, signOut };
};
