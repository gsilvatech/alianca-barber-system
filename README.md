# ✂️ Aliança Barber System - SaaS End-to-End de Agendamento & Gestão Comercial

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> **Status do Projeto:** 🚀 Em Produção (SaaS E2E Completo)
> **Link do App:** [Acesse a aplicação aqui](https://www.aliancabarberclub.com.br/)

---

## 📄 Sobre o Projeto

O **Aliança Barber System** é um ecossistema SaaS completo (Software as a Service) de agendamento e gestão comercial desenvolvido sob a ótica _Mobile-First_. O sistema foi projetado de ponta a ponta (E2E) para resolver dores reais de operações de barbearias sob o modelo de sociedade: gerenciamento de agendas, ociosidade, controle financeiro isolado por cadeira, gestão de estoque e fidelização (CRM).

Ao contrário de soluções genéricas de agendamento, este software possui um **Motor de Agendamento Semântico**, lida com regras de concorrência de horários e fornece painéis customizados, garantindo autonomia financeira e operacional para cada barbeiro.

---

## 🎯 Funcionalidades Principais

### 📊 Módulo Financeiro & BI (Business Intelligence)

- **Meu Caixa:** Gestão completa de entradas e saídas individuais por profissional, com cálculo automático de saldo líquido mensal.
- **Evolução Anual (Gráficos):** Acompanhamento visual da receita e quantidade de clientes atendidos mês a mês.
- **Gestão de Metas (Barber Goals):** Sistema de gamificação onde o profissional define metas financeiras (ex: "Trocar de carro") e acompanha o progresso líquido do mês em uma barra de progresso em tempo real.

### 👥 CRM & Clube de Vantagens (Assinaturas)

- **Gestão de Planos Recorrentes:** Criação e venda de planos de assinatura (Ex: "Cabelo e Barba Mensal"), com controle visual de cortes consumidos e disponíveis.
- **Retention Loop (Loop de Retenção):** Sistema inteligente para renovação de planos, permitindo absorver atendimentos do dia como "Upsell" no momento da venda.
- **Clientes "Ghost" (Balcão):** Cadastro rápido de clientes sem smartphone que chegam direto na barbearia, garantindo que 100% do fluxo passe pelo sistema.

### 📦 Gestão de Estoque e PDV

- **Categorização Estratégica:** Separação entre itens de "Barbearia" (pomadas, minoxidil) e "Geladeira" (bebidas).
- **Alertas Visuais:** Indicadores automáticos de baixo estoque e bloqueio de vendas para itens esgotados (Zerados).
- **Baixa Automática:** Registro de vendas com dedução imediata no inventário e injeção do valor correspondente nos relatórios do barbeiro.

### 📱 Experiência do Cliente (Área do Cliente)

- **Stepper de Agendamento Guiado:** Fluxo intuitivo em 3 passos (Escolha do profissional ➔ Seleção do serviço ➔ Seleção de data/hora).
- **Remarcação Inteligente (Sem Fricção):** O cliente altera data/hora com base na disponibilidade em tempo real do barbeiro, sem cancelar e recriar do zero.
- **Integração WhatsApp:** Cancelamentos e Suporte de Senha (geração de link mágico de reset) com ponte direta para o WhatsApp do profissional.

### 💈 Gestão da Agenda (Motor Semântico)

- **Motor Semântico de Duração:** O sistema lê a string do serviço (Ex: "Corte", "Química", "Plano") e calcula dinamicamente o tempo de bloqueio na agenda (variando de 30 a 120 minutos) blindando a agenda contra sobreposições.
- **Bloqueio de Horários Flexível:** O barbeiro pode fechar dias inteiros para folga ou selecionar horários fragmentados específicos no dia, com opção de recorrência semanal.
- **Painel Diário de Auditoria:** Visão cronológica com status visuais (Concluído, Furo, Cancelado) e capacidade de registrar falta do cliente ("No-Show") sem devolver cotas de planos de assinatura.

---

## 📱 Interface Visual

<p align="center">
  <img src="./public/screenshots/telaprincipal-portrait.png" width="30%" alt="Tela Inicial do Cliente" />
  <img src="./public/screenshots/fluxoagendamento.gif" width="30%" alt="Demonstração do Agendamento" />
  <img src="./public/screenshots/paginabarbeiro.gif" width="30%" alt="Fluxo da página do Barbeiro" />
</p>

---

## 🛠️ Stack Tecnológica

- **Frontend:** [Next.js 14+](https://nextjs.org/) (App Router) com React Hooks para gerenciamento de estados.
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/) com design focado em modo escuro (_Blackout Premium Aesthetic_).
- **Backend as a Service (BaaS):** [Supabase](https://supabase.com/) gerenciando autenticação, Storage (Avatares) e persistência de dados.
- **Banco de Dados:** [PostgreSQL](https://www.postgresql.org/) com relacionamentos estruturados, integridade referencial e RPCs (Remote Procedure Calls) para ações críticas.
- **Ícones:** [Lucide React](https://lucide.dev/) para uma interface limpa e moderna.

---

## 🧠 Desafios de Engenharia & Soluções Aplicadas

Durante o desenvolvimento deste SaaS, apliquei padrões avançados de engenharia para contornar limitações do ambiente mobile e estruturar regras complexas de negócio:

1. **Desacoplamento Arquitetural (CRM vs. Financeiro):**
   - _Desafio:_ A venda de uma "Assinatura" no CRM (com N cortes) criava um risco de duplicação de receita no painel financeiro caso o sistema somasse o valor da assinatura _e_ os agendamentos realizados através dela.
   - _Solução:_ Desacoplamento da injeção de receita. Assinaturas são registradas no banco `client_plans` apenas para controle lógico e visual, enquanto o caixa (`financial_transactions`) opera de forma cega para as agendas, garantindo a fonte da verdade na injeção manual do faturamento diário pelo barbeiro, mantendo a autonomia da operação física.

2. **Bypass de Bloqueadores de Pop-ups em Dispositivos Móveis:**
   - _Desafio:_ Navegadores mobile (Safari iOS) bloqueiam janelas `window.open` executadas após requisições assíncronas ao banco.
   - _Solução:_ Migração do redirecionamento para manipulação de `window.location.href` na API oficial (`api.whatsapp.com/send`), garantindo compatibilidade universal de 100%.

3. **Gerenciamento de Slots e Concorrência de Horários:**
   - _Desafio:_ Validar colisões de agenda e calcular blocos de tempo flexíveis sem banco de dados NoSQL.
   - _Solução:_ Implementação de um Motor de Tempo no client-side que converte horários ISO para minutos e faz _mapping_ de sobreposições através do tempo semântico da tabela `services`, garantindo bloqueio imediato na renderização do front-end.

---

## 📐 Modelo de Dados (Estrutura Principal)

O banco de dados relacional PostgreSQL no Supabase suporta múltiplos domínios do SaaS:

- `profiles` & `barbers`: Controle de acesso RBAC, dados de perfil e armazenamento de URLs do Supabase Storage.
- `appointments`: Tabela central de agendamentos com cálculo de concorrência e FKs para planos.
- `client_plans`: Core do CRM, responsável por tracking de "Cortes Usados vs Permitidos" e validade contratual.
- `financial_transactions` & `barber_goals`: Ecossistema de Business Intelligence (BI) e gamificação de metas do profissional.
- `products` & `services`: Tabelas de apoio para precificação, PDV e regras de duração de agenda.

---

## 🏁 Como Executar o Projeto Localmente

1. Clone o repositório:

   ```bash
   git clone [https://github.com/gsilvatech/alianca-barber-club.git](https://github.com/gsilvatech/alianca-barber-club.git)

   ```

2. Instale as dependências:

   ```bash
   npm install

   ```

3. Configure as variáveis de ambiente. Crie um arquivo .env.local na raiz do projeto:

   ```Snippet de código
   NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase

   ```

4. Inicie o servidor de desenvolvimento:

   ```bash
   npm run dev

   ```

5. Abra http://localhost:3000 no seu navegador.

---

### 👨‍💻 Desenvolvido por

**Gabriel Ferreira** - Desenvolvedor Full Stack

- 🔗 **GitHub:** [@gsilvatech](https://github.com/gsilvatech)
- 📸 **Instagram:** [@sougabrieloficial](https://instagram.com/sougabrieloficial)
