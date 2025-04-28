'use client';

import React, { useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
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

interface FormProps {
  icon: string;
  setIcon: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  title: string;
  setTitle: (value: string) => void;
  showForm: boolean;
  setShowForm: (value: boolean) => void;
}

const Form: React.FC<FormProps> = ({
  icon,
  setIcon,
  description,
  setDescription,
  title,
  setTitle,
  showForm,
  setShowForm
}) => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const [blinkLink, setBlinkLink] = useState('');
  const [copied, setCopied] = useState(false);
  const form = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    if (!connected || !publicKey) {
      console.error('Wallet not connected');
      return;
    }

    if (!icon || !description || !title) {
      console.error('Please fill all fields');
      window.alert('Please fill all fields');
      return;
    }

    let BlinkData;
    try {
      const walletAddress = publicKey.toString();
      const response = await fetch('/api/actions/generate-blink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          icon,
          label: 'donate Sol',
          description,
          title,
          wallet: walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate blink');
      }

      BlinkData = await response.json();
    } catch (error) {
      setLoading(false);
      console.error('Failed to generate blink', error);
      window.alert('Failed to generate blink');
      return;
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC|| clusterApiUrl("mainnet-beta"));
    const recipientPubKey = new PublicKey(process.env.NEXT_PUBLIC_WALLET || "8twrkXxvDzuUezvbkgg3LxpTEZ59KiFx2VxPFDkucLk3");
    const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
    const messageString = `${publicKey.toString() + BlinkData.id.toString()}`;
    const amount = 0.001 * LAMPORTS_PER_SOL;

    const transaction = new Transaction().add(
      new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: Buffer.from(messageString, "utf8"),
      })
    );
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: recipientPubKey,
        lamports: amount,
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    try {
      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);

      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'finalized');
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
      console.error('Failed to send transaction', error);
      window.alert('Failed to send transaction');
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
      <div className="card md:p-10 h-full" ref={form}>
        {showForm && (
          <div className="space-y-6 h-full">
            <h1 className="text-2xl md:text-3xl font-bold mb-6 gradient-text">
              Customize Your Blink
            </h1>

            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                placeholder="Enter a title for your Blink"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">Image URL</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="input-field"
                placeholder="Enter image URL"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--text-secondary)]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="textarea-field"
                rows={3}
                placeholder="Enter a description"
                maxLength={143}
              />
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {description.length}/143 characters
              </p>
            </div>

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

export default Form;
