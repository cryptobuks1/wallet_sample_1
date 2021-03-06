import React, { Component, Fragment } from 'react'
import axios from 'axios'
import PropTypes from 'prop-types'

import { connect } from 'redaction'
import actions from 'redux/actions'

import cssModules from 'react-css-modules'
import styles from './Wallet.scss'
import { isMobile } from 'react-device-detect'
import moment from 'moment'
import firestore from 'helpers/firebase/firestore'

import History from 'pages/History/History'

import { links, constants } from 'helpers'
import { localisedUrl } from 'helpers/locale'
import { getActivatedCurrencies } from 'helpers/user'
import ReactTooltip from 'react-tooltip'
import ParticalClosure from '../PartialClosure/PartialClosure'

import { FormattedMessage, injectIntl } from 'react-intl'

import config from 'helpers/externalConfig'
import { withRouter } from 'react-router'
import BalanceForm from './components/BalanceForm/BalanceForm'
import FAQ from './components/FAQ/FAQ'
import CurrenciesList from './CurrenciesList'
import Button from 'components/controls/Button/Button'
import ContentLoader from '../../components/loaders/ContentLoader/ContentLoader'

import InvoicesList from 'pages/Invoices/InvoicesList'



const isWidgetBuild = config && config.isWidget

const walletNav = [
  {
    key: 'My balances',
    text: <FormattedMessage id="MybalanceswalletNav" defaultMessage="Мой баланс" />,
    link: links.home,
    enabled: true,
  },
  {
    key: 'Transactions',
    text: <FormattedMessage id="TransactionswalletNav" defaultMessage="Активность" />,
    link: links.history,
    enabled: true,
  },
  {
    key: 'Invoices',
    text: <FormattedMessage id="InvoicesNav" defaultMessage="Инвойсы" />,
    link: links.invoices,
    enabled: (!isWidgetBuild && config.opts.invoiceEnabled),
  },
]

@connect(
  ({
    core: { hiddenCoinsList },
    user,
    user: {
      ethData,
      btcData,
      btcMultisigSMSData,
      btcMultisigUserData,
      btcMultisigUserDataList,
      tokensData,
      isFetching
    },
    currencies: { items: currencies },
    createWallet: { currencies: assets }
  }) => {
    let widgetMultiTokens = []
    if (window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length) {
      Object.keys(window.widgetERC20Tokens).forEach(key => {
        widgetMultiTokens.push(key.toUpperCase())
      })
    }
    const tokens =
      config && config.isWidget
        ? window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length
          ? widgetMultiTokens
          : [config.erc20token.toUpperCase()]
        : Object.keys(tokensData).map(k => tokensData[k].currency)

    const tokensItems = Object.keys(tokensData).map(k => tokensData[k])

    const allData = [
      btcData,
      btcMultisigSMSData,
      btcMultisigUserData,
      ethData,
      ...Object.keys(tokensData).map(k => tokensData[k])
    ].map(({ account, keyPair, ...data }) => ({
      ...data
    }))

    const items = (config && config.isWidget
      ? [
        btcData,
        ethData
      ]
      : [
        btcData,
        btcMultisigSMSData,
        btcMultisigUserData,
        ethData,
      ]
    ).map(data => data.currency)

    const currencyBalance = [
      btcData,
      btcMultisigSMSData,
      btcMultisigUserData,
      ethData,
    ].map(({ balance, currency, infoAboutCurrency }) => ({
      balance,
      infoAboutCurrency,
      name: currency
    }))

    return {
      tokens,
      items,
      allData,
      tokensItems,
      currencyBalance,
      currencies,
      assets,
      isFetching,
      hiddenCoinsList: hiddenCoinsList,
      userEthAddress: ethData.address,
      user,
      tokensData: {
        ethData,
        btcData,
        btcMultisigSMSData,
        btcMultisigUserData,
        btcMultisigUserDataList,
      }
    }
  }
)
@injectIntl
@withRouter
@connect(({ signUp: { isSigned } }) => ({
  isSigned
}))
@cssModules(styles, { allowMultiple: true })
export default class Wallet extends Component {
  constructor(props) {
    super(props)

    const {
      match: {
        params: {
          page = null,
        },
      },
    } = props

    let activeView = 0

    if (page === 'history' && !isMobile) {
      activeView = 1
    }
    if (page === 'invoices') activeView = 2

    this.balanceRef = React.createRef() // Create a ref object

    const isSweepReady = localStorage.getItem(constants.localStorage.isSweepReady)
    const isBtcSweeped = actions.btc.isSweeped()
    const isEthSweeped = actions.eth.isSweeped()

    let showSweepBanner = !isSweepReady

    if (isBtcSweeped || isEthSweeped) showSweepBanner = false

    this.state = {
      activeView,
      activePage: page,
      btcBalance: 0,
      activeCurrency: 'usd',
      exchangeForm: false,
      walletTitle: 'Wallet',
      editTitle: false,
      enabledCurrencies: getActivatedCurrencies(),
      showSweepBanner,
    }
  }

  componentWillMount() {
    actions.user.getBalances()
  }

  componentDidUpdate(prevProps) {
    const {
      match: {
        params: {
          page = null,
        },
      },
    } = this.props
    const {
      match: {
        params: {
          page: prevPage  = null,
        },
      },
    } = prevProps

    if (page !== prevPage) {
      let activeView = 0

      if (page === 'history' && !isMobile) {
        activeView = 1
      }
      if (page === 'invoices') activeView = 2
      this.setState({
        activeView,
        activePage: page,
      })
    }
  }

  componentDidMount() {
    const { params, url } = this.props.match

    if (url.includes('withdraw')) {
      this.handleWithdraw(params)
    }
    this.getInfoAboutCurrency()

    if (isMobile) {
      this.balanceRef.current.scrollIntoView({
        block: 'start'
      })
    }
  }


  getInfoAboutCurrency = async () => {
    const { currencies } = this.props
    const currencyNames = currencies.map(({ name }) => name)

    await actions.user.getInfoAboutCurrency(currencyNames)
  }

  handleNavItemClick = index => {
    if (index === 1) {
      // fetch actual tx list
      actions.user.setTransactions()
      actions.core.getSwapHistory()
    }

    this.setState({
      activeView: index
    })
  }

  handleSaveKeys = () => {
    actions.modals.open(constants.modals.PrivateKeys)
  }

  handleShowKeys = () => {
    actions.modals.open(constants.modals.DownloadModal)
  }

  handleImportKeys = () => {
    actions.modals.open(constants.modals.ImportKeys, {})
  }

  onLoadeOn = fn => {
    this.setState({
      isFetching: true
    })

    fn()
  }

  handleNotifyBlockClose = state => {
    this.setState({
      [state]: true
    })
    localStorage.setItem(constants.localStorage[state], 'true')
  }

  handleWithdraw = params => {
    const { allData } = this.props
    const { address, amount } = params
    const item = allData.find(({ currency }) => currency.toLowerCase() === params.currency.toLowerCase())

    actions.modals.open(constants.modals.Withdraw, {
      ...item,
      toAddress: address,
      amount
    })
  }

  goToСreateWallet = () => {
    const {
      history,
      intl: { locale }
    } = this.props

    history.push(localisedUrl(locale, links.createWallet))
  }

  handleGoExchange = () => {
    const {
      history,
      intl: { locale }
    } = this.props

    if (isWidgetBuild && !config.isFullBuild) {
      history.push(localisedUrl(locale, links.pointOfSell))
    } else {
      history.push(localisedUrl(locale, links.exchange))
    }
  }

  handleEditTitle = () => {
    this.setState({
      editTitle: true
    })
  }

  handleMakeSweep = () => {
    actions.modals.open(constants.modals.SweepToMnemonicKeys, {
      onSweep: () => {
        this.setState({
          showSweepBanner: false,
        })
      },
    })
  }

  handleChangeTitle = e => {
    this.setState({
      walletTitle: e.target.value
    })
    localStorage.setItem(constants.localStorage.walletTitle, e.target.value)
  }

  handleModalOpen = context => {
    const { enabledCurrencies } = this.state
    const { hiddenCoinsList } = this.props

    /* @ToDo Вынести отдельно */
    // Набор валют для виджета
    const widgetCurrencies = ['BTC']
    if (!hiddenCoinsList.includes('BTC (SMS-Protected)')) widgetCurrencies.push('BTC (SMS-Protected)')
    if (!hiddenCoinsList.includes('BTC (Multisig)')) widgetCurrencies.push('BTC (Multisig)')
    widgetCurrencies.push('ETH')
    if (isWidgetBuild) {
      if (window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length) {
        // Multi token widget build
        Object.keys(window.widgetERC20Tokens).forEach(key => {
          widgetCurrencies.push(key.toUpperCase())
        })
      } else {
        widgetCurrencies.push(config.erc20token.toUpperCase())
      }
    }

    const currencies = actions.core.getWallets()
      .filter(({ currency, balance }) => {
        return (
          ((context === 'Send') ? balance : true)
          && !hiddenCoinsList.includes(currency)
          && enabledCurrencies.includes(currency)
          && ((isWidgetBuild) ?
            widgetCurrencies.includes(currency)
            : true)
        )
      })

    actions.modals.open(constants.modals.CurrencyAction, {
      currencies,
      context
    })
  }

  checkBalance = () => {
    // that is for noxon, dont delete it :)
    const now = moment().format('HH:mm:ss DD/MM/YYYY')
    const lastCheck = localStorage.getItem(constants.localStorage.lastCheckBalance) || now
    const lastCheckMoment = moment(lastCheck, 'HH:mm:ss DD/MM/YYYY')

    const isFirstCheck = moment(now, 'HH:mm:ss DD/MM/YYYY').isSame(lastCheckMoment)
    const isOneHourAfter = moment(now, 'HH:mm:ss DD/MM/YYYY').isAfter(lastCheckMoment.add(1, 'hours'))

    const { ethData, btcData } = this.props.tokensData

    const balancesData = {
      ethBalance: ethData.balance,
      btcBalance: btcData.balance,
      ethAddress: ethData.address,
      btcAddress: btcData.address,
    }

    if (isOneHourAfter || isFirstCheck) {
      localStorage.setItem(constants.localStorage.lastCheckBalance, now)
      firestore.updateUserData(balancesData)
    }
  }

  render() {
    const {
      activeView,
      infoAboutCurrency,
      exchangeForm,
      editTitle,
      walletTitle,
      enabledCurrencies,
      banners,
      showSweepBanner,
    } = this.state
    const { currencyBalance, hiddenCoinsList, isSigned, isFetching } = this.props

    const allData = actions.core.getWallets()

    this.checkBalance()

    let btcBalance = 0
    let usdBalance = 0
    let changePercent = 0

    // Набор валют для виджета
    const widgetCurrencies = ['BTC']
    if (!hiddenCoinsList.includes('BTC (SMS-Protected)')) widgetCurrencies.push('BTC (SMS-Protected)')
    if (!hiddenCoinsList.includes('BTC (Multisig)')) widgetCurrencies.push('BTC (Multisig)')
    widgetCurrencies.push('ETH')
    if (isWidgetBuild) {
      if (window.widgetERC20Tokens && Object.keys(window.widgetERC20Tokens).length) {
        // Multi token widget build
        Object.keys(window.widgetERC20Tokens).forEach(key => {
          widgetCurrencies.push(key.toUpperCase())
        })
      } else {
        widgetCurrencies.push(config.erc20token.toUpperCase())
      }
    }

    let tableRows = allData.filter(({ currency, address, balance }) => {
      // @ToDo - В будущем нужно убрать проверку только по типу монеты.
      // Старую проверку оставил, чтобы у старых пользователей не вывалились скрытые кошельки
      return (!hiddenCoinsList.includes(currency) && !hiddenCoinsList.includes(`${currency}:${address}`)) || balance > 0
    })

    if (isWidgetBuild) {
      //tableRows = allData.filter(({ currency }) => widgetCurrencies.includes(currency))
      tableRows = allData.filter(({ currency, balance }) => !hiddenCoinsList.includes(currency))
      // Отфильтруем валюты, исключив те, которые не используются в этом билде
      tableRows = tableRows.filter(({ currency }) => widgetCurrencies.includes(currency))
    }

    tableRows = tableRows.filter(({ currency }) => enabledCurrencies.includes(currency))

    //console.log('render', tableRows)
    if (currencyBalance) {
      currencyBalance.forEach(item => {
        if ((!isWidgetBuild || widgetCurrencies.includes(item.name)) && item.infoAboutCurrency && item.balance !== 0) {
          if (item.name === 'BTC') {
            changePercent = item.infoAboutCurrency.percent_change_1h
          }
          btcBalance += item.balance * item.infoAboutCurrency.price_btc
          usdBalance += item.balance * item.infoAboutCurrency.price_usd
        }
      })
    }

    return (
      <article>
        <section styleName={isWidgetBuild && !config.isFullBuild ? 'wallet widgetBuild' : 'wallet'}>
          <ul styleName="walletNav">
            {walletNav.map(({ key, text, link, enabled }, index) => (
              (enabled) ? (
                <li
                  key={key}
                  styleName={`walletNavItem ${activeView === index ? 'active' : ''}`}
                  onClick={() => this.handleNavItemClick(index)}
                >
                  <a href={`#${link}`} styleName="walletNavItemLink">
                    {text}
                  </a>
                </li>
              ) : null
            ))}
          </ul>
          <div className="data-tut-store" styleName="walletContent" ref={this.balanceRef}>
            <div styleName={`walletBalance ${activeView === 0 ? 'active' : ''}`}>
              {/* {
                !isFetching ?  */}
              <BalanceForm
                usdBalance={usdBalance}
                currencyBalance={btcBalance}
                changePercent={changePercent}
                handleReceive={this.handleModalOpen}
                handleWithdraw={this.handleModalOpen}
                handleExchange={this.handleGoExchange}
                currency="btc"
                infoAboutCurrency={infoAboutCurrency}
              />

              {/* : <ContentLoader leftSideContent /> */}

              {exchangeForm && (
                <div styleName="exchangeForm">
                  <ParticalClosure {...this.props} isOnlyForm />
                </div>
              )}

              <div styleName="desktopEnabledViewForFaq faqWrapper">
                <FAQ />
              </div>
            </div>
            <div styleName={`yourAssetsWrapper ${activeView === 0 ? 'active' : ''}`}>
              {/* Sweep Banner */}
              {showSweepBanner && (
                <p styleName="sweepInfo">
                  <Button blue onClick={this.handleMakeSweep}>
                    <FormattedMessage id="SweepBannerButton" defaultMessage="Done" />
                  </Button>
                  <FormattedMessage
                    id="SweepBannerDescription"
                    defaultMessage={
                      `Пожалуйста, переместите все средства на кошельки помеченные "new" 
                      (USDT и остальные токены переведите на Ethereum (new) адрес). 
                      Затем нажмите кнопку "DONE". Старые адреса будут скрыты.`
                    }
                  />
                </p>
              )}
              {/* (End) Sweep Banner */}
              {activeView === 0 && (
                <CurrenciesList
                  tableRows={tableRows}
                  {...this.state}
                  {...this.props}
                  goToСreateWallet={this.goToСreateWallet}
                  getExCurrencyRate={(currencySymbol, rate) => this.getExCurrencyRate(currencySymbol, rate)}
                />
              )}

              {/* : <ContentLoader rideSideContent /> */}
            </div>
            <div styleName="mobileEnabledViewForFaq faqWrapper">
              <FAQ />
            </div>
            <div styleName={`activity ${activeView === 1 ? 'active' : ''}`}>
              {activeView === 1 && (<History { ...this.props} />)}
            </div>
            <div styleName={`activity ${activeView === 2 ? 'active' : ''}`}>
              {activeView === 2 && (<InvoicesList { ...this.props} onlyTable={true} />)}
            </div>
          </div>
          {isWidgetBuild && activeView === 0 && (
            <div styleName="keysExportImport">
              <Button gray onClick={this.handleShowKeys}>
                <FormattedMessage id="WalletPage_ExportKeys" defaultMessage="Показать ключи" />
              </Button>
              <Button gray onClick={this.handleImportKeys}>
                <FormattedMessage id="WalletPage_ImportKeys" defaultMessage="Импортировать ключи" />
              </Button>
            </div>
          )}
        </section>
      </article>
    )
  }
}
