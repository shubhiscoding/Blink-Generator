import { ReactNode } from 'react';
import { WalletButton } from '../solana/solana-provider';
import Navbar from '../navbar/navbar';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        className='Head'
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 50px',
          paddingBottom: '0px',
          width: '100%',
        }}
      >
        <h1 className='Title'>Blink Generator</h1>
        <Navbar />
        <div>
          <WalletButton />
        </div>
      </div>
      <div style={{padding: '10px' }}>{children}</div>
    </div>
  );
}
