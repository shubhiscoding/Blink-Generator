'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletButton } from '../solana/solana-provider';
import LoadingScreen from '../Loading/loading';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Connection,
  clusterApiUrl,
  TransactionInstruction
} from '@solana/web3.js';
import { HiOutlineClipboardCopy, HiOutlineShare } from 'react-icons/hi';
import { MeteoraDlmmGroup, MeteoraDlmmPair, PositionWithPoolName, getMeteoraDlmmForToken } from '@/server/meteora';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ArrowLeft } from 'lucide-react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { confirmTransaction, createTransaction } from '@/server/transaction';

interface FormProps {
  mintAddress: string;
  setMintAddress: (value: string) => void;
  showForm: boolean;
  setShowForm: (value: boolean) => void;
}

const LpForm: React.FC<FormProps> = ({
  mintAddress,
  setMintAddress,
  showForm,
  setShowForm
}) => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [blinkLink, setBlinkLink] = useState('');
  const [copied, setCopied] = useState(false);
  const form = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlmmGroups, setDlmmGroups] = useState<MeteoraDlmmGroup[]>([]);
  const [isDlmmLoading, setIsDlmmLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<MeteoraDlmmGroup | null>(null);
  const [selectedPair, setSelectedPair] = useState<MeteoraDlmmPair | null>(null);
  const [allPairs, setAllPairs] = useState<MeteoraDlmmPair[]>([]);
  const { connection } = useConnection();

  useEffect(()=>{
    setIsDlmmLoading(true);
    getMeteoraDlmmForToken(mintAddress).then((data) => {
      setDlmmGroups(data);
      setIsDlmmLoading(false);
    }).catch((error) => {
      console.error('Error fetching DLMM groups:', error);
      setIsDlmmLoading(false);
    });
  }, [mintAddress]);

  useEffect(() => {
    if(selectedGroup){
      let array = selectedGroup.pairs;
      array.sort((a, b)=>{
        return parseFloat(b.liquidity) - parseFloat(a.liquidity);
      });
      setAllPairs(array);
    }
  },[selectedGroup]);


  const handleBack = async () => {
    try {
      setLoading(true);
      if (selectedPair) {
        setSelectedPair(null);
      }else if (selectedGroup) {
        setSelectedGroup(null);
      }
      console.log(loading);
      console.log(selectedPair);
      console.log(selectedGroup);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setLoading(true);
    if (!connected || !publicKey) {
      console.error('Wallet not connected');
      return;
    }

    if (!selectedPair) {
      console.error('Please fill all fields');
      window.alert('Please fill all fields');
      return;
    }

    let BlinkData;
    const walletAddress = publicKey.toString();
    try {
      const LpBlinkData = {
        poolName: selectedPair?.name,
        Liquidity: selectedPair?.liquidity,
        Volume: selectedPair?.trade_volume_24h,
        APR: selectedPair?.apr,
        Fee: selectedPair?.base_fee_percentage,
        DailyFee: selectedPair?.fees_24h,
        BinStep: selectedPair?.bin_step,
        TokenXName: selectedPair?.name.split('-')[0],
        TokenYName: selectedPair?.name.split('-')[1],
        mintX: selectedPair?.mint_x,
        mintY: selectedPair?.mint_y,
        wallet: walletAddress,
        poolId: selectedPair.address,
      }
      const response = await fetch('/api/actions/generate-blink/lp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(LpBlinkData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate blink');
      }

      BlinkData = await response.json();

      const messageString = `${publicKey.toString() + BlinkData.id.toString()}`;
      const getTransaction = await createTransaction(messageString, 0.0001, publicKey.toString());
      const  {serializedTransaction, blockhash, lastValidBlockHeight} = getTransaction;

      const transaction = Transaction.from(Buffer.from(serializedTransaction, 'base64'));
      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);

      const confirmation = await confirmTransaction(
        signature,
        blockhash,
        lastValidBlockHeight
      );

      console.log('Transaction confirmed:', confirmation);

      const res = await fetch('/api/actions/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          orderId: BlinkData.id.toString(),
        }),
      });

      const link = await res.json();
      if (!link.blinkLink) {
        throw new Error('Failed to generate blink');
      }

      setBlinkLink(link.blinkLink);
      setShowForm(false);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      console.error('Failed to generate blink', error);
      window.alert('Failed to generate blink');
      return;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://dial.to/?action=solana-action:${blinkLink}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleTweet = () => {
    const tweetText = `Check out this Blink I just made @getblinkdotfun: https://dial.to/?action=solana-action:${blinkLink}`;
    const twitterUrl = `https://X.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank');
  };

  const handleNew = () => {
    setShowForm(true);
  };

  return (
    <div className="w-full max-w-2xl h-full">
      {loading && <LoadingScreen subtext="Waiting For Transaction Confirmation!!" />}
      <div className="card md:p-8 h-full" ref={form}>
        {showForm && (
          <div className="space-y-4 h-full">
            <h1 className="text-2xl md:text-3xl font-bold mb-4 gradient-text">
              Liquidity Position Blink
            </h1>

            {!selectedGroup && <div>
              <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">Explore Pools</label>
              <input
                type="text"
                value={mintAddress}
                onChange={(e) => setMintAddress(e.target.value)}
                className="input-field"
                placeholder="Search by mint address"
                maxLength={50}
              />
            </div>}

            {!selectedGroup &&
            <div className='card max-h-96 overflow-y-auto minimal-scrollbar pr-1'>
              <CardHeader>
                <CardTitle>Select DLMM Group</CardTitle>
                <CardDescription>Choose a liquidity group</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isDlmmLoading ? (
                  <>
                    <Skeleton className="h-[68px] w-full rounded-lg" />
                    <Skeleton className="h-[68px] w-full rounded-lg" />
                    <Skeleton className="h-[68px] w-full rounded-lg" />
                  </>
                ) : (
                  dlmmGroups?.map((group) => (
                    <div
                      key={group.name}
                      className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                      onClick={() => setSelectedGroup(group)}
                    >
                      <div>
                        <div className="font-medium">{group.name}</div>
                        <div className="text-sm text-muted-foreground">
                          TVL: ${group.totalTvl.toFixed(0).toLocaleString()} •
                          APR: {group.maxApr.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </div>}

            {selectedGroup && !selectedPair && (
              <div className='card max-h-96 overflow-y-auto minimal-scrollbar pr-1'>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {console.log("back"); handleBack();}}
                  className="mt-2 ml-2 h-8 px-2 shadow-sm border-[1px] border-[var(--border-color)]"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                <>
                  <CardHeader>
                    <CardTitle>Select Pool</CardTitle>
                    <CardDescription>Choose a liquidity pool</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {loading ? (
                      <>
                        <Skeleton className="h-[68px] w-full rounded-lg" />
                        <Skeleton className="h-[68px] w-full rounded-lg" />
                        <Skeleton className="h-[68px] w-full rounded-lg" />
                      </>
                    ) : (
                      allPairs?.map((pair) => (
                        <div
                          key={pair.address}
                          className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                          onClick={() => setSelectedPair(pair)}
                        >
                          <div>
                            <div className="font-medium">{pair.name}</div>
                            <div className="text-sm text-muted-foreground">
                              TVL: $
                              {Number.parseFloat(pair.liquidity)
                                .toFixed(0)
                                .toLocaleString()}{' '}
                              • APR: {pair.apr.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </>
              </div>
            )}

            {selectedGroup && selectedPair && (
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {console.log("back"); handleBack();}}
                  className="h-8 px-2 shadow-sm border-[1px] border-[var(--border-color)]"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                <Card>
                  <CardHeader className='p-5'>
                    <CardTitle>{selectedPair.name}</CardTitle>
                    <CardDescription>Pool Information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-1">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Liquidity</Label>
                        <div className="font-medium">
                          $
                          {Number.parseFloat(
                            selectedPair.liquidity,
                          ).toLocaleString()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">24h Volume</Label>
                        <div className="font-medium">
                          ${selectedPair.trade_volume_24h.toLocaleString()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">APR</Label>
                        <div className="font-medium">
                          {selectedPair.apr.toFixed(2)}%
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Bin Step</Label>
                        <div className="font-medium">{selectedPair.bin_step}</div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Fee %</Label>
                        <div className="font-medium">
                          {Number.parseFloat(
                            selectedPair.base_fee_percentage,
                          ).toFixed(2)}
                          %
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">24h Fees</Label>
                        <div className="font-medium">
                          ${selectedPair.fees_24h.toLocaleString()}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Pool Id</Label>
                        <div className="font-medium">
                          {selectedPair.address.toString()}
                        </div>
                      </div>
                    </div>

                    {/* <Separator /> */}

                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Token Pair</Label>
                      <div className="grid gap-3.5 text-sm">
                        <div className="font-medium">
                          {selectedPair.name.split('-')[0]} : {selectedPair.mint_x}
                        </div>
                        <div className="font-medium">
                          {selectedPair.name.split('-')[1]} : {selectedPair.mint_y}
                        </div>
                        {/* <div className="font-medium">
                          Swap ratio: 1 {selectedPair.tokenXName?.symbol} ={' '}
                          {swapRatio.toFixed(9)} {selectedPair.tokenYName?.symbol}
                        </div> */}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {publicKey ? (
              <button
                className="button-primary w-full mt-4"
                onClick={handlePreview}
                disabled={!connected}
              >
                Generate Blink
              </button>
            ) : (
              <div className="mt-4 text-center">
                <p className="text-[var(--text-secondary)] mb-3">Connect your wallet to generate a Blink</p>
                <WalletButton />
              </div>
            )}
          </div>
        )}

        {!showForm && (
          <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 gradient-text">
              Your Blink is Ready!
            </h1>

            <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
              <p className="text-sm text-[var(--text-secondary)] mb-2">Blink Link:</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-[rgba(0,0,0,0.2)] rounded-lg text-sm overflow-hidden overflow-ellipsis whitespace-nowrap">
                  https://dial.to/?action=solana-action:{blinkLink}
                </div>
                <button
                  onClick={handleCopy}
                  className="p-3 rounded-lg bg-[var(--border-color)] hover:bg-[var(--accent-primary)] transition-colors duration-300"
                  title="Copy to clipboard"
                >
                  {copied ? 'Copied!' : <HiOutlineClipboardCopy size={20} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <button
                className="button-primary flex-1"
                onClick={handleTweet}
              >
                <HiOutlineShare size={18} className="mr-2" />
                Share on X
              </button>

              <button
                className="button-secondary flex-1"
                onClick={handleNew}
              >
                Create New Blink
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LpForm;
