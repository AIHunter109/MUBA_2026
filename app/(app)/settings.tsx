import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { PlaceholderCard } from '@/components/app-page';
import { Screen } from '@/components/screen';
import {
  Button,
  Card,
  Divider,
  Eyebrow,
  Notice,
  SectionHeading,
  Sheet,
  Subtitle,
  Title,
} from '@/components/ui';
import { useAuth } from '@/lib/auth/auth-context';
import { copyOrShare, copyVerb } from '@/lib/design/share-text';
import { c, mono } from '@/lib/design/tokens';
import { requestTestnetSui } from '@/lib/sui/faucet';

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'info' | 'warn'>('info');
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const requestGas = useCallback(async () => {
    if (!session?.walletAddress) {
      return;
    }
    setIsRequesting(true);
    setNotice(null);
    try {
      await requestTestnetSui(session.walletAddress);
      setNoticeTone('info');
      setNotice('Testnet SUI requested. It should arrive in a few seconds.');
    } catch (error) {
      setNoticeTone('warn');
      setNotice(error instanceof Error ? error.message : 'Faucet request failed.');
    } finally {
      setIsRequesting(false);
    }
  }, [session?.walletAddress]);

  const copyAddress = useCallback(async () => {
    if (!session?.walletAddress) {
      return;
    }
    try {
      const verb = await copyOrShare(session.walletAddress, 'My Sui address');
      setNoticeTone('info');
      setNotice(verb === 'copied' ? 'Address copied.' : 'Address shared.');
    } catch (error) {
      setNoticeTone('warn');
      setNotice(error instanceof Error ? error.message : 'Could not copy the address.');
    }
  }, [session?.walletAddress]);

  return (
    <Screen>
      <View className="max-w-[760px] gap-6">
        <View className="gap-2">
          <Title>Settings</Title>
          <Subtitle>Your wallet, the network it runs on, and the safeguards around it.</Subtitle>
        </View>

        {notice ? <Notice tone={noticeTone}>{notice}</Notice> : null}

        <View className="gap-1">
          <SectionHeading title="Account" />
          <Card className="mt-4 gap-4">
            <View className="gap-1">
              <Eyebrow>Signed in as</Eyebrow>
              <Text className={`text-[15px] font-semibold ${c.textInk}`}>
                {session?.displayName}
              </Text>
              <Text className={`text-[12.5px] ${c.textInk2}`}>{session?.email}</Text>
            </View>
            <Divider />
            <View className="gap-2">
              <Eyebrow>Sui testnet wallet</Eyebrow>
              <Text style={[mono, { fontSize: 12 }]} className={c.textInk} selectable>
                {session?.walletAddress}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button
                label={`${copyVerb} address`}
                icon="copy-outline"
                variant="secondary"
                onPress={() => void copyAddress()}
              />
              <Button
                label="Request testnet SUI"
                icon="water-outline"
                variant="secondary"
                busy={isRequesting}
                onPress={() => void requestGas()}
              />
            </View>
            {session?.isDemo ? (
              <Notice tone="info">
                Demo session. This wallet was generated on this device and is not linked to a Google
                account.
              </Notice>
            ) : null}
          </Card>
        </View>

        <View className="gap-1">
          <SectionHeading title="Safeguards" />
          <View className="mt-4 gap-3">
            <PlaceholderCard
              title="VeriPlan"
              detail="Plan your budget before setting up recurring remittances. Describe your income, essential expenses, savings target, and family support, and budget analysis will help explain payment affordability."
              action="Create a plan"
            />
            <PlaceholderCard
              title="Guardians"
              detail="Trusted people who can provide a second approval for high-value or high-risk payments."
              action="Add guardian"
            />
            <PlaceholderCard
              title="Payment policies"
              detail="Set thresholds and rules for new recipients, changed wallets, and second-person approval."
              action="Add policy"
            />
            <PlaceholderCard
              title="Notifications and language"
              detail="Notification preferences and language selection will be available here."
            />
          </View>
        </View>

        <Button label="Sign out" variant="danger" onPress={() => setConfirmSignOut(true)} />
      </View>

      <Sheet visible={confirmSignOut} title="Sign out" onClose={() => setConfirmSignOut(false)}>
        <Text className={`text-[13px] leading-[20px] ${c.textInk2}`}>
          You can sign back in with the same Google account and your wallet address will be the
          same.
        </Text>
        <View className="flex-row gap-2">
          <Button
            label="Stay"
            variant="secondary"
            onPress={() => setConfirmSignOut(false)}
            className="flex-1"
          />
          <Button
            label="Sign out"
            variant="danger"
            onPress={() => {
              setConfirmSignOut(false);
              void signOut();
            }}
            className="flex-1"
          />
        </View>
      </Sheet>
    </Screen>
  );
}
