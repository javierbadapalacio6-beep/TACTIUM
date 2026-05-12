import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import {
  AmbientBackdrop,
  IconApple,
  IconGoogle,
  IconMail,
  IconBack,
  IconEye,
  IconEyeOff,
  Input,
} from '@components/ui';
import { useAuthStore } from '@store/authStore';

import type { AuthStackScreenProps } from '@navigation/types';

type Mode = 'choice' | 'email';
type Tab = 'signin' | 'signup';

export const LoginScreen = ({ navigation: _ }: AuthStackScreenProps<'Login'>) => {
  const [mode, setMode] = useState<Mode>('choice');
  const [tab, setTab] = useState<Tab>('signin');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const insets = useSafeAreaInsets();
  const signIn = useAuthStore((s) => s.signInWithPassword);
  const signUp = useAuthStore((s) => s.signUpWithPassword);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);

  // Cuando el teclado está abierto, ya cubre el home indicator y la
  // clearance extra del footer (insets+24) deja un hueco visible feo.
  // Reducimos a un mínimo razonable mientras el teclado esté presente.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sShow = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const sHide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      sShow.remove();
      sHide.remove();
    };
  }, []);
  const footerInset = keyboardOpen ? 8 : insets.bottom + 24;

  const isSignup = tab === 'signup';
  const valid =
    mode === 'email'
      ? isSignup
        ? email.includes('@') && pass.length >= 6 && name.trim().length >= 2
        : email.includes('@') && pass.length >= 6
      : true;

  const handleEmail = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    const { error } = isSignup
      ? await signUp(email.trim(), pass, name.trim())
      : await signIn(email.trim(), pass);
    setSubmitting(false);

    if (error) {
      Alert.alert(
        isSignup ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesión',
        error,
      );
      return;
    }

    if (isSignup) {
      Alert.alert(
        'Cuenta creada',
        'Revisa tu email para confirmar la cuenta antes de iniciar sesión.',
      );
    }
  };

  const handleOAuthStub = (provider: 'Apple' | 'Google') => {
    Alert.alert(
      `${provider} próximamente`,
      `Configura el proveedor ${provider} en el dashboard de Supabase para activarlo.`,
    );
  };

  const handleForgotPassword = () => {
    // Si el usuario ya tecleó email, lo prefilleamos.
    const trimmed = email.trim();
    Alert.prompt
      ? Alert.prompt(
          'Recuperar contraseña',
          'Introduce tu email. Recibirás un enlace para restablecer la contraseña.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Enviar',
              onPress: async (input?: string) => {
                const target = (input ?? trimmed).trim();
                if (!target.includes('@')) {
                  Alert.alert('Email inválido', 'Comprueba el email.');
                  return;
                }
                const { error } = await sendPasswordReset(target);
                if (error) {
                  Alert.alert('No se pudo enviar', error);
                } else {
                  Alert.alert(
                    'Email enviado',
                    `Si existe una cuenta con ${target}, recibirás un enlace para restablecer la contraseña.`,
                  );
                }
              },
            },
          ],
          'plain-text',
          trimmed,
        )
      : // Android: Alert.prompt no existe. Si el usuario tecleó email lo
        // usamos directamente; si no, pedimos que lo introduzca antes.
        (async () => {
          if (!trimmed.includes('@')) {
            Alert.alert(
              'Introduce tu email',
              'Escribe primero tu email en el formulario y vuelve a pulsar "¿Olvidaste?".',
            );
            return;
          }
          const { error } = await sendPasswordReset(trimmed);
          if (error) {
            Alert.alert('No se pudo enviar', error);
          } else {
            Alert.alert(
              'Email enviado',
              `Si existe una cuenta con ${trimmed}, recibirás un enlace para restablecer la contraseña.`,
            );
          }
        })();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <AmbientBackdrop />
      {mode === 'choice' ? (
        <ChoiceView
          insetTop={insets.top}
          insetBottom={insets.bottom}
          onApple={() => handleOAuthStub('Apple')}
          onGoogle={() => handleOAuthStub('Google')}
          onEmail={() => setMode('email')}
        />
      ) : (
        <EmailView
          insetTop={insets.top}
          insetBottom={footerInset}
          tab={tab}
          setTab={setTab}
          email={email}
          setEmail={setEmail}
          pass={pass}
          setPass={setPass}
          name={name}
          setName={setName}
          showPass={showPass}
          setShowPass={setShowPass}
          valid={valid}
          submitting={submitting}
          onBack={() => setMode('choice')}
          onSubmit={handleEmail}
          onForgotPassword={handleForgotPassword}
        />
      )}
    </KeyboardAvoidingView>
  );
};

interface ChoiceProps {
  insetTop: number;
  insetBottom: number;
  onApple: () => void;
  onGoogle: () => void;
  onEmail: () => void;
}

const ChoiceView: React.FC<ChoiceProps> = ({
  insetTop,
  insetBottom,
  onApple,
  onGoogle,
  onEmail,
}) => {
  return (
    <View style={[styles.container, { paddingTop: insetTop }]}>
      <View style={styles.hero}>
        <TactiumMark size={104} gradient />
        <Text style={styles.wordmark}>TACTIUM</Text>
        <Text style={styles.tag}>CREATE · ANALYZE · ELEVATE</Text>
        <Text style={styles.lede}>
          El laboratorio de alineaciones inteligentes para pádel.
        </Text>
      </View>

      <View style={[styles.actions, { paddingBottom: insetBottom + 28 }]}>
        <Pressable
          onPress={onApple}
          style={({ pressed }) => [
            styles.providerBtn,
            { backgroundColor: '#fff' },
            pressed && { opacity: 0.85 },
          ]}
        >
          <IconApple size={18} color="#000" />
          <Text style={[styles.providerLabel, { color: '#000' }]}>
            Continuar con Apple
          </Text>
        </Pressable>

        <Pressable
          onPress={onGoogle}
          style={({ pressed }) => [
            styles.providerBtn,
            styles.providerGhost,
            pressed && { opacity: 0.85 },
          ]}
        >
          <IconGoogle size={18} />
          <Text style={[styles.providerLabel, { color: Colors.text }]}>
            Continuar con Google
          </Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>O</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          onPress={onEmail}
          style={({ pressed }) => [
            styles.providerBtn,
            styles.providerEmail,
            pressed && { opacity: 0.85 },
          ]}
        >
          <IconMail size={18} color={Colors.accent} />
          <Text style={[styles.providerLabel, { color: Colors.accent }]}>
            Continuar con email
          </Text>
        </Pressable>

        <Text style={styles.trialNote}>
          14 días de prueba gratis al crear tu primer equipo · Sin compromiso
        </Text>
        <Text style={styles.legal}>
          Al continuar aceptas los Términos{'\n'}y la Política de Privacidad.
        </Text>
      </View>
    </View>
  );
};

interface EmailProps {
  insetTop: number;
  insetBottom: number;
  tab: Tab;
  setTab: (t: Tab) => void;
  email: string;
  setEmail: (s: string) => void;
  pass: string;
  setPass: (s: string) => void;
  name: string;
  setName: (s: string) => void;
  showPass: boolean;
  setShowPass: (b: boolean) => void;
  valid: boolean;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onForgotPassword: () => void;
}

const EmailView: React.FC<EmailProps> = ({
  insetTop,
  insetBottom,
  tab,
  setTab,
  email,
  setEmail,
  pass,
  setPass,
  name,
  setName,
  showPass,
  setShowPass,
  valid,
  submitting,
  onBack,
  onSubmit,
  onForgotPassword,
}) => {
  const isSignup = tab === 'signup';
  const disabled = !valid || submitting;
  return (
    <View style={[styles.container, { paddingTop: insetTop + 8 }]}>
      <View style={styles.emailHeader}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.backChip,
            pressed && { opacity: 0.7 },
          ]}
        >
          <IconBack size={14} color={Colors.text} />
          <Text style={styles.backChipText}>Atrás</Text>
        </Pressable>
        <TactiumMark size={32} gradient />
      </View>

      <ScrollView
        contentContainerStyle={styles.emailScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          {isSignup ? 'CREAR CUENTA' : 'INICIAR SESIÓN'}
        </Text>
        <Text style={styles.emailTitle}>
          {isSignup ? (
            <>
              Únete a <Text style={{ color: Colors.accent }}>TACTIUM</Text>
            </>
          ) : (
            <>Bienvenido{'\n'}de vuelta</>
          )}
        </Text>
        <Text style={styles.emailLede}>
          {isSignup
            ? 'Configura tu cuenta y empieza a gestionar tu equipo.'
            : 'Accede a tu equipo y planifica la próxima jornada.'}
        </Text>

        <View style={styles.tabs}>
          {(['signin', 'signup'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[
                styles.tab,
                tab === k && {
                  backgroundColor: Colors.bgRaised,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: tab === k ? Colors.text : Colors.textMuted },
                ]}
              >
                {k === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
              </Text>
            </Pressable>
          ))}
        </View>

        {isSignup && (
          <Input
            label="Nombre"
            value={name}
            onChangeText={setName}
            placeholder="Carlos Pérez"
            autoCapitalize="words"
          />
        )}

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <Input
          label="Contraseña"
          value={pass}
          onChangeText={setPass}
          placeholder={isSignup ? 'Mínimo 6 caracteres' : '••••••••'}
          secureTextEntry={!showPass}
          autoCapitalize="none"
          rightSlot={
            <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8}>
              {showPass ? (
                <IconEyeOff size={18} color={Colors.textMuted} />
              ) : (
                <IconEye size={18} color={Colors.textMuted} />
              )}
            </Pressable>
          }
          hint={
            !isSignup ? (
              <Pressable
                onPress={onForgotPassword}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Recuperar contraseña"
              >
                <Text style={styles.hint}>¿Olvidaste?</Text>
              </Pressable>
            ) : undefined
          }
        />
      </ScrollView>

      <View style={[styles.emailFooter, { paddingBottom: insetBottom }]}>
        <Pressable
          disabled={disabled}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.cta,
            disabled && { opacity: 0.4 },
            pressed && !disabled && { opacity: 0.85 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#001810" />
          ) : (
            <Text style={styles.ctaLabel}>
              {isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => setTab(isSignup ? 'signin' : 'signup')}
          hitSlop={6}
          style={{ alignSelf: 'center' }}
        >
          <Text style={styles.swap}>
            {isSignup ? '¿Ya tienes cuenta? ' : '¿Nuevo aquí? '}
            <Text style={{ color: Colors.accent, fontWeight: '600' }}>
              {isSignup ? 'Inicia sesión' : 'Crea una cuenta'}
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 32,
  },
  wordmark: {
    color: Colors.text,
    fontSize: 44,
    letterSpacing: 8,
    paddingLeft: 8,
    fontFamily: Fonts.sans,
    fontWeight: '600',
  },
  tag: {
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 5,
    fontWeight: '500',
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
    marginTop: 4,
  },
  actions: {
    paddingHorizontal: 24,
    gap: 10,
  },
  providerBtn: {
    height: 54,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  providerGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  providerEmail: {
    backgroundColor: 'rgba(0,223,130,0.08)',
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  providerLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 6,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.hair,
  },
  dividerText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textFaint,
  },
  trialNote: {
    textAlign: 'center',
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 14,
    paddingHorizontal: 18,
  },
  legal: {
    textAlign: 'center',
    color: Colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  emailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  backChip: {
    height: 36,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
  },
  backChipText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  emailScroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
    marginBottom: 10,
  },
  emailTitle: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  emailLede: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 22,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'none',
    letterSpacing: 0,
  },
  emailFooter: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  cta: {
    height: 54,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: {
    color: '#001810',
    fontSize: 16,
    fontWeight: '700',
  },
  swap: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
