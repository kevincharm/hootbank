import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'

import { cookieStorage, createStorage } from 'wagmi'
import { gnosis } from 'wagmi/chains'

export const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID

if (!projectId) throw new Error('Project ID is not defined')

const metadata = {
    name: 'hoot.bank',
    description: 'HOOOOOOOT',
    url: 'https://hootbank.smoketre.es', // origin must match your domain & subdomain
    icons: ['https://avatars.githubusercontent.com/u/37784886'],
}

// Create wagmiConfig
const chains = [gnosis] as const
export const config = defaultWagmiConfig({
    chains,
    projectId,
    metadata,
    ssr: false,
    storage: createStorage({
        storage: cookieStorage,
    }),
})
