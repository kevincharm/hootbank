'use client'
import { Box, Button, Input, Text } from '@chakra-ui/react'
import { useWriteContract } from 'wagmi'
import DelayABI from '../abis/Delay'
import { encodeFunctionData, formatUnits, parseUnits } from 'viem'
import {
    OrderQuoteSideKindSell,
    SigningScheme,
    COW_PROTOCOL_SETTLEMENT_CONTRACT_ADDRESS,
    OrderBookApi,
} from '@cowprotocol/cow-sdk'
import GPv2SettlementABI from '../abis/GPv2Settlement'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { EURE_ADDRESS, SDAI_ADDRESS } from '@/config/addresses'

const chainId = 100
const orderBookApi = new OrderBookApi({ chainId })

interface DepositProps {
    safeAddress: `0x${string}`
    delayModuleAddress: `0x${string}`
}
export function Deposit({ safeAddress, delayModuleAddress }: DepositProps) {
    const [sellAmount, setSellAmount] = useState<string>('')

    const { data: quote } = useQuery({
        queryKey: ['getQuote', safeAddress, delayModuleAddress, sellAmount] as const,
        queryFn: async (q) => {
            const [, safeAddress, , sellAmount] = q.queryKey
            if (!sellAmount) return null
            const parsedSellAmount = parseUnits(sellAmount, 18 /** EURe decimals */).toString()
            const { quote } = await orderBookApi.getQuote({
                sellToken: EURE_ADDRESS,
                buyToken: SDAI_ADDRESS,
                from: safeAddress,
                receiver: safeAddress,
                sellAmountBeforeFee: parsedSellAmount,
                kind: OrderQuoteSideKindSell.SELL,
            })
            return quote
        },
        // refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: false,
    })

    const {
        mutate: sendOrder,
        data: sendOrderData,
        reset: resetSendOrder,
        status: sendOrderStatus,
    } = useMutation({
        mutationKey: ['orderData', quote],
        mutationFn: async () => {
            if (!quote) return null
            const orderId = await orderBookApi.sendOrder({
                ...quote,
                from: safeAddress,
                receiver: safeAddress,
                signature: '0x',
                signingScheme: SigningScheme.PRESIGN,
            })
            return {
                orderId,
                preSignCalldata: encodeFunctionData({
                    abi: GPv2SettlementABI,
                    functionName: 'setPreSignature',
                    args: [orderId as `0x${string}`, true],
                }),
            }
        },
    })
    const { orderId, preSignCalldata } = sendOrderData || {}

    const {
        writeContract: _queuePreSign,
        status: queuePreSignStatus,
        reset: resetQueuePreSign,
    } = useWriteContract()
    const queuePreSign = () => {
        if (!preSignCalldata) return

        _queuePreSign({
            address: delayModuleAddress,
            abi: DelayABI,
            functionName: 'execTransactionFromModule',
            args: [
                COW_PROTOCOL_SETTLEMENT_CONTRACT_ADDRESS[chainId] as `0x${string}`,
                0n,
                preSignCalldata,
                0 /** call */,
            ],
        })
    }

    const { writeContract: _execPreSign, status: execPreSignStatus } = useWriteContract({
        mutation: {
            onSuccess() {
                resetQueuePreSign()
            },
        },
    })
    const execPreSign = () => {
        if (!preSignCalldata) return null

        _execPreSign({
            address: delayModuleAddress,
            abi: DelayABI,
            functionName: 'executeNextTx',
            args: [
                COW_PROTOCOL_SETTLEMENT_CONTRACT_ADDRESS[chainId] as `0x${string}`,
                0n,
                preSignCalldata,
                0 /** call */,
            ],
        })
    }

    const { data: order } = useQuery({
        queryKey: ['order', orderId] as const,
        queryFn: async (q) => {
            const [, orderId] = q.queryKey
            if (!orderId) return null
            const order = await orderBookApi.getOrder(orderId)
            return order
        },
        refetchInterval: 5000,
        enabled: Boolean(orderId),
    })

    return (
        <Box>
            <Input
                type="text"
                placeholder="Deposit EURe amount"
                value={sellAmount}
                onChange={(event) => {
                    setSellAmount(event.target.value)
                }}
            />
            {quote && (
                <Box>
                    <Text>
                        Sell {formatUnits(BigInt(quote.sellAmount), 18)} EURe, get{' '}
                        {formatUnits(BigInt(quote.buyAmount), 18)} sDAI
                    </Text>
                    {quote && !orderId && sendOrderStatus !== 'pending' && (
                        <Button
                            onClick={() => sendOrder?.()}
                            disabled={sendOrderStatus === 'success'}
                        >
                            Send Order
                        </Button>
                    )}
                    {sendOrderData && queuePreSignStatus !== 'pending' && (
                        <Button
                            onClick={() => queuePreSign?.()}
                            disabled={queuePreSignStatus === 'success'}
                        >
                            Sign & queue presignature
                        </Button>
                    )}
                    {execPreSignStatus !== 'pending' && (
                        <Button
                            onClick={() => execPreSign?.()}
                            disabled={execPreSignStatus === 'success'}
                        >
                            Execute order
                        </Button>
                    )}
                    {order && <Box>Order status: {order.status}</Box>}
                </Box>
            )}
        </Box>
    )
}
