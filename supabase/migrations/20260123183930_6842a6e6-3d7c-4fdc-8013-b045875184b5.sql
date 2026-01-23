-- Migração de dados históricos: popular bairro baseado no campo endereco
-- Usando lista de bairros conhecidos da região de Curitiba

-- Centro e região central
UPDATE fichas_de_servico SET bairro = 'Centro' WHERE bairro IS NULL AND (endereco ILIKE '%centro%' OR endereco ILIKE '%centro cívico%');
UPDATE fichas_de_servico SET bairro = 'Centro Cívico' WHERE bairro IS NULL AND endereco ILIKE '%centro cívico%';
UPDATE fichas_de_servico SET bairro = 'Rebouças' WHERE bairro IS NULL AND endereco ILIKE '%rebouças%';
UPDATE fichas_de_servico SET bairro = 'Alto da Glória' WHERE bairro IS NULL AND endereco ILIKE '%alto da glória%';
UPDATE fichas_de_servico SET bairro = 'Alto da XV' WHERE bairro IS NULL AND endereco ILIKE '%alto da xv%';
UPDATE fichas_de_servico SET bairro = 'Juvevê' WHERE bairro IS NULL AND endereco ILIKE '%juvevê%';
UPDATE fichas_de_servico SET bairro = 'Hugo Lange' WHERE bairro IS NULL AND endereco ILIKE '%hugo lange%';
UPDATE fichas_de_servico SET bairro = 'Jardim Social' WHERE bairro IS NULL AND endereco ILIKE '%jardim social%';
UPDATE fichas_de_servico SET bairro = 'Cabral' WHERE bairro IS NULL AND endereco ILIKE '%cabral%';
UPDATE fichas_de_servico SET bairro = 'Ahu' WHERE bairro IS NULL AND endereco ILIKE '%ahu%';
UPDATE fichas_de_servico SET bairro = 'Bom Retiro' WHERE bairro IS NULL AND endereco ILIKE '%bom retiro%';
UPDATE fichas_de_servico SET bairro = 'São Francisco' WHERE bairro IS NULL AND endereco ILIKE '%são francisco%';

-- Zona Sul
UPDATE fichas_de_servico SET bairro = 'Água Verde' WHERE bairro IS NULL AND endereco ILIKE '%água verde%';
UPDATE fichas_de_servico SET bairro = 'Batel' WHERE bairro IS NULL AND endereco ILIKE '%batel%';
UPDATE fichas_de_servico SET bairro = 'Bigorrilho' WHERE bairro IS NULL AND endereco ILIKE '%bigorrilho%';
UPDATE fichas_de_servico SET bairro = 'Champagnat' WHERE bairro IS NULL AND endereco ILIKE '%champagnat%';
UPDATE fichas_de_servico SET bairro = 'Cristo Rei' WHERE bairro IS NULL AND endereco ILIKE '%cristo rei%';
UPDATE fichas_de_servico SET bairro = 'Jardim Botânico' WHERE bairro IS NULL AND endereco ILIKE '%jardim botânico%';
UPDATE fichas_de_servico SET bairro = 'Prado Velho' WHERE bairro IS NULL AND endereco ILIKE '%prado velho%';
UPDATE fichas_de_servico SET bairro = 'Parolin' WHERE bairro IS NULL AND endereco ILIKE '%parolin%';
UPDATE fichas_de_servico SET bairro = 'Guaíra' WHERE bairro IS NULL AND endereco ILIKE '%guaíra%';
UPDATE fichas_de_servico SET bairro = 'Portão' WHERE bairro IS NULL AND endereco ILIKE '%portão%';
UPDATE fichas_de_servico SET bairro = 'Vila Izabel' WHERE bairro IS NULL AND endereco ILIKE '%vila izabel%';
UPDATE fichas_de_servico SET bairro = 'Seminário' WHERE bairro IS NULL AND endereco ILIKE '%seminário%';
UPDATE fichas_de_servico SET bairro = 'Lindóia' WHERE bairro IS NULL AND endereco ILIKE '%lindóia%';
UPDATE fichas_de_servico SET bairro = 'Novo Mundo' WHERE bairro IS NULL AND endereco ILIKE '%novo mundo%';
UPDATE fichas_de_servico SET bairro = 'Fanny' WHERE bairro IS NULL AND endereco ILIKE '%fanny%';
UPDATE fichas_de_servico SET bairro = 'Hauer' WHERE bairro IS NULL AND endereco ILIKE '%hauer%';
UPDATE fichas_de_servico SET bairro = 'Boqueirão' WHERE bairro IS NULL AND (endereco ILIKE '%boqueirão%' OR endereco ILIKE '%boqueirao%');
UPDATE fichas_de_servico SET bairro = 'Xaxim' WHERE bairro IS NULL AND endereco ILIKE '%xaxim%';
UPDATE fichas_de_servico SET bairro = 'Capão Raso' WHERE bairro IS NULL AND endereco ILIKE '%capão raso%';
UPDATE fichas_de_servico SET bairro = 'Pinheirinho' WHERE bairro IS NULL AND endereco ILIKE '%pinheirinho%';
UPDATE fichas_de_servico SET bairro = 'Sítio Cercado' WHERE bairro IS NULL AND endereco ILIKE '%sítio cercado%';
UPDATE fichas_de_servico SET bairro = 'Umbará' WHERE bairro IS NULL AND endereco ILIKE '%umbará%';
UPDATE fichas_de_servico SET bairro = 'Ganchinho' WHERE bairro IS NULL AND endereco ILIKE '%ganchinho%';
UPDATE fichas_de_servico SET bairro = 'Tatuquara' WHERE bairro IS NULL AND endereco ILIKE '%tatuquara%';
UPDATE fichas_de_servico SET bairro = 'Campo de Santana' WHERE bairro IS NULL AND endereco ILIKE '%campo de santana%';
UPDATE fichas_de_servico SET bairro = 'Caximba' WHERE bairro IS NULL AND endereco ILIKE '%caximba%';

-- Zona Leste
UPDATE fichas_de_servico SET bairro = 'Jardim das Américas' WHERE bairro IS NULL AND endereco ILIKE '%jardim das américas%';
UPDATE fichas_de_servico SET bairro = 'Guabirotuba' WHERE bairro IS NULL AND endereco ILIKE '%guabirotuba%';
UPDATE fichas_de_servico SET bairro = 'Uberaba' WHERE bairro IS NULL AND endereco ILIKE '%uberaba%';
UPDATE fichas_de_servico SET bairro = 'Cajuru' WHERE bairro IS NULL AND endereco ILIKE '%cajuru%';
UPDATE fichas_de_servico SET bairro = 'Capão da Imbuia' WHERE bairro IS NULL AND endereco ILIKE '%capão da imbuia%';
UPDATE fichas_de_servico SET bairro = 'Tarumã' WHERE bairro IS NULL AND endereco ILIKE '%tarumã%';

-- Zona Norte
UPDATE fichas_de_servico SET bairro = 'Bacacheri' WHERE bairro IS NULL AND endereco ILIKE '%bacacheri%';
UPDATE fichas_de_servico SET bairro = 'Boa Vista' WHERE bairro IS NULL AND endereco ILIKE '%boa vista%';
UPDATE fichas_de_servico SET bairro = 'Tingui' WHERE bairro IS NULL AND endereco ILIKE '%tingui%';
UPDATE fichas_de_servico SET bairro = 'Atuba' WHERE bairro IS NULL AND endereco ILIKE '%atuba%';
UPDATE fichas_de_servico SET bairro = 'Bairro Alto' WHERE bairro IS NULL AND endereco ILIKE '%bairro alto%';
UPDATE fichas_de_servico SET bairro = 'Santa Cândida' WHERE bairro IS NULL AND endereco ILIKE '%santa cândida%';
UPDATE fichas_de_servico SET bairro = 'Pilarzinho' WHERE bairro IS NULL AND endereco ILIKE '%pilarzinho%';
UPDATE fichas_de_servico SET bairro = 'São Lourenço' WHERE bairro IS NULL AND endereco ILIKE '%são lourenço%';
UPDATE fichas_de_servico SET bairro = 'Vista Alegre' WHERE bairro IS NULL AND endereco ILIKE '%vista alegre%';
UPDATE fichas_de_servico SET bairro = 'Cachoeira' WHERE bairro IS NULL AND endereco ILIKE '%cachoeira%';
UPDATE fichas_de_servico SET bairro = 'Barreirinha' WHERE bairro IS NULL AND endereco ILIKE '%barreirinha%';
UPDATE fichas_de_servico SET bairro = 'Abranches' WHERE bairro IS NULL AND endereco ILIKE '%abranches%';
UPDATE fichas_de_servico SET bairro = 'Taboão' WHERE bairro IS NULL AND endereco ILIKE '%taboão%';

-- Zona Oeste
UPDATE fichas_de_servico SET bairro = 'Santa Felicidade' WHERE bairro IS NULL AND endereco ILIKE '%santa felicidade%';
UPDATE fichas_de_servico SET bairro = 'Butiatuvinha' WHERE bairro IS NULL AND endereco ILIKE '%butiatuvinha%';
UPDATE fichas_de_servico SET bairro = 'Lamenha Pequena' WHERE bairro IS NULL AND endereco ILIKE '%lamenha pequena%';
UPDATE fichas_de_servico SET bairro = 'São Braz' WHERE bairro IS NULL AND endereco ILIKE '%são braz%';
UPDATE fichas_de_servico SET bairro = 'Cascatinha' WHERE bairro IS NULL AND endereco ILIKE '%cascatinha%';
UPDATE fichas_de_servico SET bairro = 'Campo Comprido' WHERE bairro IS NULL AND endereco ILIKE '%campo comprido%';
UPDATE fichas_de_servico SET bairro = 'Mossunguê' WHERE bairro IS NULL AND endereco ILIKE '%mossunguê%';
UPDATE fichas_de_servico SET bairro = 'Santo Inácio' WHERE bairro IS NULL AND endereco ILIKE '%santo inácio%';
UPDATE fichas_de_servico SET bairro = 'Vista Alegre' WHERE bairro IS NULL AND endereco ILIKE '%vista alegre%';
UPDATE fichas_de_servico SET bairro = 'Orleans' WHERE bairro IS NULL AND endereco ILIKE '%orleans%';
UPDATE fichas_de_servico SET bairro = 'São João' WHERE bairro IS NULL AND endereco ILIKE '%são joão%';
UPDATE fichas_de_servico SET bairro = 'Mercês' WHERE bairro IS NULL AND endereco ILIKE '%mercês%';
UPDATE fichas_de_servico SET bairro = 'Bom Retiro' WHERE bairro IS NULL AND endereco ILIKE '%bom retiro%';
UPDATE fichas_de_servico SET bairro = 'Ahú' WHERE bairro IS NULL AND endereco ILIKE '%ahú%';

-- Região Metropolitana - Colombo
UPDATE fichas_de_servico SET bairro = 'Centro', cidade = 'Colombo' WHERE bairro IS NULL AND endereco ILIKE '%colombo%';

-- Região Metropolitana - São José dos Pinhais
UPDATE fichas_de_servico SET cidade = 'São José dos Pinhais' WHERE cidade IS NULL AND endereco ILIKE '%são josé dos pinhais%';
UPDATE fichas_de_servico SET cidade = 'São José dos Pinhais' WHERE cidade IS NULL AND endereco ILIKE '%sjp%';

-- Região Metropolitana - Araucária
UPDATE fichas_de_servico SET cidade = 'Araucária' WHERE cidade IS NULL AND endereco ILIKE '%araucária%';

-- Região Metropolitana - Pinhais
UPDATE fichas_de_servico SET cidade = 'Pinhais' WHERE cidade IS NULL AND endereco ILIKE '%pinhais%';

-- Região Metropolitana - Almirante Tamandaré
UPDATE fichas_de_servico SET cidade = 'Almirante Tamandaré' WHERE cidade IS NULL AND endereco ILIKE '%almirante tamandaré%';

-- Região Metropolitana - Campo Largo
UPDATE fichas_de_servico SET cidade = 'Campo Largo' WHERE cidade IS NULL AND endereco ILIKE '%campo largo%';

-- Região Metropolitana - Fazenda Rio Grande
UPDATE fichas_de_servico SET cidade = 'Fazenda Rio Grande' WHERE cidade IS NULL AND endereco ILIKE '%fazenda rio grande%';

-- Região Metropolitana - Piraquara
UPDATE fichas_de_servico SET cidade = 'Piraquara' WHERE cidade IS NULL AND endereco ILIKE '%piraquara%';

-- Região Metropolitana - Quatro Barras
UPDATE fichas_de_servico SET cidade = 'Quatro Barras' WHERE cidade IS NULL AND endereco ILIKE '%quatro barras%';

-- Região Metropolitana - Campina Grande do Sul
UPDATE fichas_de_servico SET cidade = 'Campina Grande do Sul' WHERE cidade IS NULL AND endereco ILIKE '%campina grande do sul%';

-- Default Curitiba para fichas sem cidade definida
UPDATE fichas_de_servico SET cidade = 'Curitiba' WHERE cidade IS NULL AND bairro IS NOT NULL;