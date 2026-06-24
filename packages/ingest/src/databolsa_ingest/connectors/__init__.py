from .b3_corporate_actions import B3CorporateActionsConnector
from .b3_cotahist import B3CotahistConnector
from .b3_index_composition import B3IndexCompositionConnector
from .b3_indices import B3IndicesConnector
from .b3_intraday import B3IntradayConnector
from .bcb_copom import BcbCopomConnector
from .bcb_focus import BcbFocusConnector
from .bcb_sgs import BcbSgsConnector
from .crypto import CryptoConnector
from .cvm_dfp_itr import CvmDfpItrConnector
from .cvm_fii import CvmFiiConnector
from .cvm_forms import CvmFcaConnector, CvmFreConnector
from .cvm_ipe import CvmIpeConnector
from .cvm_vlmo import CvmVlmoConnector
from .fnet_fii import FnetFiiConnector
from .fred import FredConnector
from .ibge_sidra import IbgeSidraConnector
from .ipeadata import IpeadataConnector
from .tesouro_direto import TesouroDiretoConnector

# Ordem importa: cvm_fca e b3_cotahist antes de b3_corporate_actions (o universo
# de emissores do histórico de proventos vem do FCA + COTAHIST)
CONNECTORS = {
    cls.source: cls
    for cls in (
        BcbSgsConnector,
        BcbFocusConnector,
        BcbCopomConnector,
        TesouroDiretoConnector,
        B3CotahistConnector,
        B3IndicesConnector,
        B3IndexCompositionConnector,
        CvmDfpItrConnector,
        CvmFcaConnector,
        CvmFreConnector,
        CvmIpeConnector,
        CvmFiiConnector,
        FnetFiiConnector,
        CvmVlmoConnector,
        B3CorporateActionsConnector,
        B3IntradayConnector,
        CryptoConnector,
        IpeadataConnector,
        IbgeSidraConnector,
        FredConnector,
    )
}

__all__ = ["CONNECTORS"]
